import { RuleTester } from 'eslint'
import rule from '../../../lib/rules/no-short-scientific'

const ruleTester = new RuleTester()
ruleTester.run('no-short-scientific', rule, {
    valid: [
        { code: '1' },
        { code: '10' },
        { code: '100' },
        { code: '1000' },
        { code: '10000' },
        { code: '1E5' },
        { code: '1E6' },
        { code: '1E7' },
    ],
    invalid: [
        {
            code: '1E3',
            errors: [{ messageId: 'scientific' }],
        },
    ],
})
