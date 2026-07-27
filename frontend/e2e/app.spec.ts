import { expect, test, type Page } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures')

const SAMPLE_COUNT = (
  JSON.parse(
    readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), '../public/samples/manifest.json'),
      'utf8'
    )
  ) as unknown[]
).length

const FACE = path.join(fixturesDir, 'face.jpg')
const PLATE = path.join(fixturesDir, 'plate.jpg')
const MULTI = path.join(fixturesDir, 'multi_faces.jpg')
const EXTRAS = Array.from({ length: 7 }, (_, i) =>
  path.join(fixturesDir, `extra_${i + 4}.jpg`)
)

async function uploadImages(page: Page, files: string[]) {
  await page.locator('input[type="file"][accept="image/*"]').setInputFiles(files)
}

async function waitDetectDone(page: Page) {
  await expect(page.locator('.status', { hasText: '检测中' })).toHaveCount(0, {
    timeout: 30000,
  })
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.feature-item')).toHaveCount(2)
})

test('首页加载并显示检测功能列表', async ({ page }) => {
  await expect(page.locator('.feature-item', { hasText: '人脸检测' })).toBeVisible()
  await expect(page.locator('.feature-item', { hasText: '车牌检测' })).toBeVisible()
  await expect(page.locator('.renderer-item')).toHaveCount(2)
})

test('上传单图后显示原图与检测结果，且缩略图只有一张', async ({ page }) => {
  await uploadImages(page, [FACE])

  await expect(page.locator('.thumb')).toHaveCount(1)
  await expect(page.locator('.thumb').first()).toHaveClass(/active/)
  await expect(page.locator('.pane-canvas')).toHaveCount(2)
  await waitDetectDone(page)
})

test('上传多图默认选中第一张，点击缩略图切换', async ({ page }) => {
  await uploadImages(page, [FACE, PLATE, MULTI])
  await expect(page.locator('.thumb')).toHaveCount(3)
  await expect(page.locator('.thumb').nth(0)).toHaveClass(/active/)
  await waitDetectDone(page)

  await page.locator('.thumb').nth(1).click()
  await expect(page.locator('.thumb').nth(1)).toHaveClass(/active/)
  await expect(page.locator('.thumb').nth(0)).not.toHaveClass(/active/)
  await waitDetectDone(page)
})

test('打开新批次后旧的图片完全清空', async ({ page }) => {
  await uploadImages(page, [FACE, PLATE, MULTI])
  await expect(page.locator('.thumb')).toHaveCount(3)
  await waitDetectDone(page)

  await uploadImages(page, [PLATE])
  await expect(page.locator('.thumb')).toHaveCount(1)
  await expect(page.locator('.thumb-name').first()).toHaveText('plate.jpg')
})

test('缩略图列表内部横向滚动，页面无横向滚动条', async ({ page }) => {
  await uploadImages(page, [FACE, PLATE, MULTI, ...EXTRAS])
  await expect(page.locator('.thumb')).toHaveCount(10)
  await waitDetectDone(page)

  const pageOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  )
  expect(pageOverflow).toBeLessThanOrEqual(0)

  const strip = page.locator('.thumbnail-strip')
  const before = await strip.evaluate((el) => el.scrollLeft)
  await strip.hover()
  await page.mouse.wheel(0, 600)
  await page.waitForTimeout(300)
  const after = await strip.evaluate((el) => el.scrollLeft)
  expect(after).toBeGreaterThan(before)
})

test('切换展示方式（画框/马赛克）', async ({ page }) => {
  await uploadImages(page, [FACE])
  await waitDetectDone(page)

  await page.locator('.renderer-item', { hasText: '马赛克' }).click()
  await expect(
    page.locator('.renderer-item', { hasText: '马赛克' })
  ).toHaveClass(/active/)
})

test('缩略图列表固定在页面底部，不随图片大小移动', async ({ page }) => {
  await uploadImages(page, [FACE, MULTI])
  await expect(page.locator('.thumb')).toHaveCount(2)
  await waitDetectDone(page)

  const strip = page.locator('.thumbnail-strip')
  const viewportH = page.viewportSize()!.height
  const bottomOf = async () =>
    (await strip.boundingBox())!.y + (await strip.boundingBox())!.height

  const bottomSmall = await bottomOf()
  expect(bottomSmall).toBeGreaterThan(viewportH - 160)

  await page.locator('.thumb').nth(1).click()
  await waitDetectDone(page)
  const bottomLarge = await bottomOf()
  expect(Math.abs(bottomLarge - bottomSmall)).toBeLessThan(2)
})

test('检测结果与原图画布尺寸一致且非空白', async ({ page }) => {
  await uploadImages(page, [FACE])
  await waitDetectDone(page)

  const canvases = page.locator('.pane-canvas')
  const sizes = await canvases.evaluateAll((els) =>
    els.map((el) => {
      const c = el as HTMLCanvasElement
      const data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data
      let nonZero = 0
      for (let i = 3; i < data.length; i += 4000) if (data[i] !== 0) nonZero++
      return { width: c.width, height: c.height, nonZero }
    })
  )
  expect(sizes).toHaveLength(2)
  expect(sizes[0].width).toBeGreaterThan(0)
  expect(sizes[1].width).toBe(sizes[0].width)
  expect(sizes[1].height).toBe(sizes[0].height)
  expect(sizes[0].nonZero).toBeGreaterThan(0)
  expect(sizes[1].nonZero).toBeGreaterThan(0)
})

test('内置测试图片增量加载，首张立即可测，最终数量齐全', async ({ page }) => {
  await page.locator('button', { hasText: '加载内置测试图片' }).click()

  await expect(page.locator('.thumb').first()).toBeVisible()
  await expect(page.locator('.thumb').first()).toHaveClass(/active/)
  await expect(page.locator('.pane-canvas')).toHaveCount(2)
  await waitDetectDone(page)

  await expect(page.locator('.thumb')).toHaveCount(SAMPLE_COUNT, { timeout: 60000 })
  await expect(
    page.locator('button', { hasText: '加载内置测试图片' })
  ).toBeEnabled()

  await expect
    .poll(
      async () =>
        page.locator('.thumb img').evaluateAll(
          (els) =>
            els.filter((e) => !(e as HTMLImageElement).complete || (e as HTMLImageElement).naturalWidth === 0)
              .length
        ),
      { timeout: 30000 }
    )
    .toBe(0)
})

test('内置测试图片加载中上传本地图片，终止加载并清空已加载图片', async ({
  page,
}) => {
  await page.locator('button', { hasText: '加载内置测试图片' }).click()
  await expect(page.locator('.thumb').first()).toBeVisible()

  await uploadImages(page, [FACE])
  await expect(page.locator('.thumb')).toHaveCount(1)
  await expect(page.locator('.thumb-name').first()).toHaveText('face.jpg')
  await waitDetectDone(page)

  await page.waitForTimeout(2000)
  await expect(page.locator('.thumb')).toHaveCount(1)
})
