import type { Rule } from 'eslint'
import { findPairs } from '../../eslint-utils'

const alwaysParen = ['<<', '>>', '>>>', '&', '^', '|']

const confusingSets = [
    [
        ['**'],
        ['*', '/', '%'],
        ['+', '-'],
    ],
    [
        ['<<', '>>', '>>>'],
        ['<', '<=', '>', '>=', 'in', 'instanceof'],
        ['==', '!=', '===', '!=='],
    ],
    [
        ['&&'],
        ['||', '??'],
    ],
]

const confusingMaps = confusingSets.map(s => new Map(s.map((a, i) => a.map(b => [b, i + 1] as const)).flat(1)))

const rule: Rule.RuleModule = {
    meta: {
        type: 'suggestion',
        docs: {
            description: 'Enforce parentheses around binary expressions with confusing precedence.',
            category: 'De-Minification',
            recommended: true,
        },
        fixable: 'code',
    },
    create(context) {
        return {
            BinaryExpression(node) {
                const parent = node.parent
                if (parent.type === 'BinaryExpression') {

                    if (node.operator !== parent.operator && (alwaysParen.includes(node.operator) || confusingMaps.some(m => {
                        const n = m.get(node.operator)
                        const p = m.get(parent.operator)
                        return n && p && n != p
                    }))) {
                        // Check for parens
                        const source = context.getSourceCode()
                        const parens = findPairs(source, node, ['(', ')'])
                        if (!parens.length) {
                            context.report({
                                node,
                                message: 'Binary expression without parens',
                                fix(fixer) {
                                    return [
                                        fixer.insertTextBefore(node, '('),
                                        fixer.insertTextAfter(node, ')'),
                                    ]
                                },
                            })
                        }
                    }
                }
            },
        }
    },
}

export = rule;
