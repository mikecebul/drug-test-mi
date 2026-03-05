import { describe, expect, test } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { WizardContainer } from '../WizardContainer'

describe('WizardContainer', () => {
  test('applies horizontal padding so content does not touch sidebar edges', () => {
    const markup = renderToStaticMarkup(
      <WizardContainer>
        <div>Content</div>
      </WizardContainer>,
    )

    expect(markup).toContain('px-4')
    expect(markup).toContain('md:px-6')
  })
})
