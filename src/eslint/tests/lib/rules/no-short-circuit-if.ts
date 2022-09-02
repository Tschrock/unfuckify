import { RuleTester } from 'eslint'
import rule from '../../../lib/rules/no-short-circuit-if'

const ruleTester = new RuleTester({ env: { es6: true } })
ruleTester.run('no-short-circuit-if', rule, {
    valid: [
        {
            code: 'if (foo) bar()',
        },
        {
            code: 'const baz = foo && bar()',
        },
    ],
    invalid: [
        {
            code: 'foo && bar()',
            errors: [{ messageId: 'logicalIf' }],
            output: 'if (foo) bar()',
        },
    ],
})
