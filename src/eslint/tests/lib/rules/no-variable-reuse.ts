import { RuleTester } from 'eslint'
import rule from '../../../lib/rules/no-variable-reuse'

const ruleTester = new RuleTester({ languageOptions: { ecmaVersion: 'latest' } })
ruleTester.run('no-variable-reuse', rule, {
    valid: [
        {
            code: 'let x = 0; log(x);',
        },
        {
            code: 'let x = 0; if (foo) x = 1; log(x);',
        },
        {
            code: 'let x = 0; function foo() { x = 1; }; log(x);',
        },
    ],
    invalid: [
        {
            code: 'let x = 0; log(x); x = 1; log(x);',
            errors: [{ messageId: 'reusedVariable' }],
        },
        {
            code: 'let x = 0; log(x); while(foo) { x = 2; log(x); }',
            errors: [{ messageId: 'reusedVariable' }],
        },
    ],
})
