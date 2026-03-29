import { test, expect } from '@playwright/test'

test.describe('Formularz zlecenia', () => {
  test('otwiera listę zleceń i przechodzi do nowego zlecenia', async ({ page }) => {
    await page.goto('/orders')
    await expect(page).toHaveURL(/\/orders\/?$/)
    await page.getByRole('link', { name: 'Nowe zlecenie' }).click()
    await expect(page).toHaveURL(/\/orders\/new/)
    await expect(page.getByRole('heading', { name: /nowe zlecenie/i })).toBeVisible()
  })

  test('formularz nowego zlecenia pokazuje sekcje i podsumowanie', async ({ page }) => {
    await page.goto('/orders/new')
    await expect(page.getByText(/Nagłówek zlecenia|Nagłówek/i)).toBeVisible()
    await expect(page.getByText(/Podsumowanie:/)).toBeVisible()
    await expect(page.getByText(/Netto:/)).toBeVisible()
    await expect(page.getByRole('button', { name: /utwórz zlecenie/i })).toBeVisible()
  })

  test('edycja zlecenia ładuje formularz', async ({ page }) => {
    await page.goto('/orders')
    const editLinks = page.getByRole('link', { name: 'Edytuj' })
    const count = await editLinks.count()
    if (count === 0) {
      test.skip()
      return
    }
    await editLinks.first().click()
    await expect(page).toHaveURL(/\/orders\/[a-f0-9-]+/)
    await expect(page.getByRole('heading', { name: /edytuj zlecenie/i })).toBeVisible()
  })
})
