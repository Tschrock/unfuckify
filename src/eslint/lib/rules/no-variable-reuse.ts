import type { Rule, Scope } from 'eslint'
import type { Identifier } from 'estree'
// import { removePairs } from '../../eslint-utils'

class Stack<T> {
    private readonly stack: T[] = []
    public push(...items: T[]): number {
        return this.stack.push(...items)
    }
    public pop(): T | undefined {
        return this.stack.pop()
    }
    public peek(): T | undefined {
        return this.stack[this.stack.length - 1]
    }
    public any(): boolean {
        return this.stack.length > 0
    }
}

class MapList<K, V> extends Map<K, Array<V>> {
    public add(key: K, value: V): number {
        const values = this.get(key)
        if (values) {
            return values.push(value)
        } else {
            this.set(key, [value])
            return 1
        }
    }
}

const rule: Rule.RuleModule = {
    meta: {
        type: 'suggestion',
        docs: {
            description: 'Disallows reusing a variable for multiple assignments.',
            category: 'De-Minification',
            recommended: true,
        },
        // fixable: 'code',
        messages: {
            reusedVariable: 'Reused variable.',
        },
    },
    create(context) {
        const codePathStack = new Stack<Rule.CodePath>()
        const codePathSegmentStack = new Stack<Rule.CodePathSegment>()
        const identifierCodePathSegments = new Map<Identifier, Rule.CodePathSegment>()
        const codePathSegmentIdentifiers = new MapList<Rule.CodePathSegment, Identifier>()
        const codePathVariables = new MapList<Rule.CodePath, Scope.Variable>()

        function analyzeVariable(variable: Scope.Variable): MapList<Scope.Reference, Scope.Reference> {
            // console.log('analyze(' + variable.name + ')')
            // Ensure all references are inside the same variableScope
            const notInScope = variable.references.some(r => r.from.variableScope !== variable.scope.variableScope)
            if (notInScope) {
                // console.log('Not all in scope')
                return new MapList()
            }

            // Find all variable writes
            const writes = variable.references.filter(ref => ref.isWrite())
            // console.log(writes.length)

            // For each write, look forward and find all reads it effects
            const readWrites = new MapList<Scope.Reference, Scope.Reference>()
            const writeReads = new MapList<Scope.Reference, Scope.Reference>()
            for (const write of writes) {
                const reads = getReadsForWrite(variable, write)
                // Record the reads this write effects
                writeReads.set(write, reads)
                reads.forEach(read => readWrites.add(read, write))
            }

            // Cool, now we can actually check
            const seperatableWrites = new MapList<Scope.Reference, Scope.Reference>()
            writes.shift() // Exclude the first write
            for (const write of writes) {
                // console.log('write ' + loc2str(write.identifier.loc))
                let canSeperate = true
                const reads = writeReads.get(write) ?? []
                for (const read of reads) {
                    const w = readWrites.get(read) ?? []
                    // console.log('   read ' + loc2str(read.identifier.loc) + `(${w.length})`)
                    if (w.length > 1) {
                        canSeperate = false
                        break
                    }
                }
                if (canSeperate) {
                    seperatableWrites.set(write, reads)
                }
            }
            return seperatableWrites
        }

        function notNull<T>(value: T | null | undefined): value is T {
            return value !== null && typeof value !== 'undefined'
        }

        // Gets all reads that a write would effect by following the code path forward from the write
        function getReadsForWrite(variable: Scope.Variable, write: Scope.Reference): Scope.Reference[] {
            // Get the code path segment the write is in
            const codePathSegment = identifierCodePathSegments.get(write.identifier)
            if (!codePathSegment) return []
            else return getReadsForWrite2(codePathSegment, variable, write)
        }

        // Gets all reads that a write would effect by following the code path forward from the write
        function getReadsForWrite2(codePathSegment: Rule.CodePathSegment, variable: Scope.Variable, write: Scope.Reference, seenSegments: Rule.CodePathSegment[] = []): Scope.Reference[] {
            if (seenSegments.includes(codePathSegment)) return []
            seenSegments.push(codePathSegment)
            // Get all variable references in the code path segment
            const segmentIdentifiers = codePathSegmentIdentifiers.get(codePathSegment) ?? []
            const segmentReferences = segmentIdentifiers.map(id => variable.references.find(ref => ref.identifier === id)).filter(notNull)

            // Start at the write
            const startIndex = segmentReferences.findIndex(ref => ref === write) + 1

            // Look forward and mark all reads until the next write
            const reads: Scope.Reference[] = []
            for (let i = startIndex; i < segmentReferences.length; i++) {
                const ref = segmentReferences[i]
                if (ref.isWrite()) {
                    // Stop looking
                    return reads
                }
                if (ref.isRead()) {
                    reads.push(ref)
                }
            }
            // Look through the following segments too
            for (const next of codePathSegment.nextSegments) {
                reads.push(...getReadsForWrite2(next, variable, write, seenSegments))
            }
            return reads
        }

        return {
            onCodePathSegmentStart(codePathSegment) {
                codePathSegmentStack.push(codePathSegment)
            },
            onCodePathSegmentEnd() {
                codePathSegmentStack.pop()
            },
            onCodePathStart(codePath) {
                codePathStack.push(codePath)
            },
            onCodePathEnd() {
                const path = codePathStack.pop()
                if (path) {
                    const variables = codePathVariables.get(path) ?? []
                    for (const variable of variables) {

                        const segmented = analyzeVariable(variable)
                        // console.log(segmented.size)

                        if (segmented.size) {
                            for (const [write] of segmented) {
                                context.report({
                                    node: write.identifier,
                                    messageId: 'reusedVariable',
                                })
                            }
                        }
                    }
                }
            },
            Identifier(node) {
                const currentSegment = codePathSegmentStack.peek()
                if (currentSegment) {
                    identifierCodePathSegments.set(node, currentSegment)
                    codePathSegmentIdentifiers.add(currentSegment, node)
                }
            },
            VariableDeclaration(node) {
                const currentCodePath = codePathStack.peek()
                if (currentCodePath) {
                    const variables = context.getDeclaredVariables(node)
                    for (const variable of variables) {
                        codePathVariables.add(currentCodePath, variable)
                    }
                }
            },
        }
    },
}

export = rule;
