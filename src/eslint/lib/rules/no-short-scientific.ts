import type { Rule } from 'eslint'

function isScientific(value: string) {
    return value.includes('e') || value.includes('E')
}

const rule: Rule.RuleModule = {
    meta: {
        type: 'suggestion',
        docs: {
            description: 'Disallows using scientific notation for small numbers.',
            category: 'De-Minification',
            recommended: true,
        },
        fixable: 'code',
        schema: [{
            type: 'integer',
        }],
        messages: {
            scientific: 'Scientific notation used for number {{number}}.',
        },
    },
    create(context) {
        const [maxInt = 99999] = context.options as [number | undefined]
        return {
            Literal(node) {
                const { value, raw } = node
                if (value && raw && typeof value === 'number' && Number.isInteger(value) && isScientific(raw) && value < maxInt) {
                    context.report({
                        node,
                        messageId: 'scientific',
                        fix(fixer) {
                            return fixer.replaceText(node, value.toString(10))
                        },
                    })
                }
            },
        }
    },
}

export = rule;
