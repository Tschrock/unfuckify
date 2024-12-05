import { RuleTester } from 'eslint'
import rule from '../../../lib/rules/no-ternary-if'

const ruleTester = new RuleTester({ languageOptions: { ecmaVersion: 'latest' } })
ruleTester.run('no-ternary-if', rule, {
    valid: [
        {
            code: 'if (foo) { bar() } else { baz() }',
        },
        {
            code: 'const test = foo ? bar() : baz()',
        },
    ],
    invalid: [
        {
            code: 'foo ? bar() : baz()',
            errors: [{ messageId: 'ternaryIf' }],
            output: 'if (foo) { bar() } else { baz() }',
        },
    ],
})
