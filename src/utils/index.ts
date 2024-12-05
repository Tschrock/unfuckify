import fs from 'node:fs/promises'

import prettier from 'prettier'
import { Linter } from 'eslint'

import customRules from '../eslint/lib/rules'

/**
 * Repeats the given function untill the output is stable or the limit is reached.
 */
export function repeatUntilStable<T>(input: T, fn: (input: T) => T, limit = 5): T {
    let oldValue, newValue = fn(input)
    while (oldValue != newValue && --limit) {
        oldValue = newValue
        newValue = fn(oldValue)
    }
    return newValue
}

const DEFAULT_PRETTIER: prettier.Options = {
    parser: 'espree',
}

interface EslintConfig extends Linter.Config {
    factory?: () => Linter
    linter?: Linter
}

const DEFAULT_LINTER = new Linter()
DEFAULT_LINTER.defineRules(customRules)

const ESLINT_CONFIG_DEFAULT: Linter.Config & { linter: Linter } = {
    linter: DEFAULT_LINTER,
    root: true,
    env: {
        browser: true,
        es6: true,
    },
    parserOptions: {
        ecmaVersion: 'latest',
    },
}

function isPlainObject(obj: unknown): obj is object {
    return typeof obj === 'object'
        && obj !== null
        && Object.getPrototypeOf(obj) === Object.getPrototypeOf({})
        && Object.values(Object.getOwnPropertyDescriptors(obj)).every(d => 'value' in d && d.writable && d.enumerable && d.configurable)
}

function mergePlainConfig<T extends object, U extends object>(base: T, override?: U | undefined): T & U {
    if (!override) return base as T & U
    const configEntries = []
    const keys = new Set([...Object.keys(base), ...Object.keys(override)])
    for (const key of keys) {
        const baseValue = (base as Record<string, unknown>)[key]
        const overrideValue = (override as Record<string, unknown>)[key]
        if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
            configEntries.push([key, mergePlainConfig(baseValue, overrideValue)])
        } else {
            configEntries.push([key, overrideValue ?? baseValue])
        }
    }
    return Object.fromEntries(configEntries) as T & U
}

function getConfigLinter(config: EslintConfig): Linter {
    if (config.linter) {
        return config.linter
    }
    if (config.factory) {
        return config.factory()
    }
    return DEFAULT_LINTER
}


/**
 * Runs prettier over the string.
 * @param source The source string.
 * @param options Prettier options.
 * @returns The formatted string.
 */
export function formatPrettier(source: string, options?: prettier.Options | undefined): Promise<string> {
    return prettier.format(source, { ...DEFAULT_PRETTIER, ...options })
}

/**
 * Formats a source string using eslint auto-fixers.
 * @param source The source string.
 * @param rules The rules to run.
 * @param config Formatter options.
 * @returns The formatted source string.
 */
export function formatEslint(source: string, rules: Partial<Linter.RulesRecord>, config?: EslintConfig | undefined): string {
    const fullConfig = mergePlainConfig(ESLINT_CONFIG_DEFAULT, config)
    const eslintConfig = { ...fullConfig, rules }
    const linter = getConfigLinter(fullConfig)
    const report = linter.verifyAndFix(source, eslintConfig)
    if (report.messages.some(m => m.fatal)) {
        throw new EsLintFatalError('Fatal error during eslint fix', report)
    }
    return report.output
}

export class EsLintFatalError extends Error {
    constructor(message: string, public readonly report: Linter.FixReport) {
        super(message)
    }
}

/**
 * Formats a source string using eslint auto-fixers. This is similar to `formatEslint`, but it runs multiple passes of each rule.
 * @param source The source string.
 * @param rules The rules to run.
 * @param config Formatter options.
 * @returns The formatted source string.
 */
export function formatEslintRules(source: string, rules: Partial<Linter.RulesRecord>, config?: EslintConfig | undefined): string {
    config = ensureEslintConfig(config)
    for (const [key, value] of Object.entries(rules)) {
        source = repeatUntilStable(source, c => formatEslint(c, { [key]: value }, config), 4)
    }
    return source
}

/**
 * Formats a source string using eslint auto-fixers. This is similar to `formatEslintRules`, but it runs multiple passes of each group of rules.
 * @param source The source string.
 * @param rules A list of groups of rules to run.
 * @param config Formatter options.
 * @returns The formatted source string.
 */
export function formatEslintRulesets(source: string, rulesets: Partial<Linter.RulesRecord>[], config?: EslintConfig | undefined): string {
    config = ensureEslintConfig(config)
    for (const ruleset of rulesets) {
        source = repeatUntilStable(source, c => formatEslint(c, ruleset, config), 6)
    }
    return source
}

function ensureEslintConfig(config?: EslintConfig | undefined): EslintConfig & { linter: Linter } {
    const newConfig = { ...ESLINT_CONFIG_DEFAULT, ...config }
    if (newConfig.factory) {
        newConfig.linter = newConfig.factory()
        newConfig.factory = undefined
    }
    return newConfig
}

interface FormatOptions {
    eslint?: EslintConfig
    prettier?: prettier.Options
}

const DefaultFormatOptions = {
    eslint: ESLINT_CONFIG_DEFAULT,
    prettier: DEFAULT_PRETTIER,
}

function ensureCustomRules(linter: Linter) {
    const existingRules = linter.getRules()
    for (const [key, rule] of Object.entries(customRules)) {
        if (!existingRules.has(key)) {
            linter.defineRule(key, rule)
        }
    }
}

export async function opinionatedFormatFile(infile: string, outfile: string, options?: FormatOptions | undefined): Promise<void> {
    const source = await fs.readFile(infile, 'utf-8')
    const formatted = await opinionatedFormat(source, options)
    await fs.writeFile(outfile, formatted)
}

/**
 * Applies multiple passes of an opinionated set of formatting options designed to make reverse engeneering easier.
 */
export async function opinionatedFormat(source: string, options?: FormatOptions | undefined): Promise<string> {
    const realConfig = { ...DefaultFormatOptions, ...options }
    const eslintConfig = ensureEslintConfig(realConfig.eslint)
    ensureCustomRules(eslintConfig.linter)
    const prettierConfig = realConfig.prettier

    // First formatting pass
    source = await formatPrettier(source, prettierConfig)

    // Cleanup and de-minification
    source = formatEslintRulesets(source, [
        // Starting cleanup
        {
            // Variables
            'one-var': ['warn', 'never'],
            'no-var': ['warn'],
            'prefer-const': ['warn'],

            // General Cleanup
            'unfuckify/no-short-scientific': ['warn'],
            'no-floating-decimal': ['warn'],
            'no-implicit-coercion': ['warn'],
            'yoda': ['warn', 'never'],
        },
        // De-minify conditionals and sequences
        {
            'unfuckify/no-short-circuit-as-if': ['warn'],
            'unfuckify/no-ternary-as-if': ['warn'],
            'unfuckify/no-unused-sequence': ['warn'],
            'curly': ['warn'],
            'no-lonely-if': ['warn'],
            'no-unneeded-ternary': ['warn'],
        },
    ], eslintConfig)

    // Second formatting pass
    source = await formatPrettier(source, prettierConfig)

    // Second dleanup and de-minification
    source = formatEslint(source, {
        'brace-style': ['warn', '1tbs'],
        'comma-dangle': ['warn', 'always-multiline'],
        'comma-style': ['warn', 'last'],
        'operator-linebreak': ['warn', 'before', {
            'overrides': {
                '=': 'none',
            },
        }],
        'no-multi-spaces': ['warn'],
        'unfuckify/operator-parens': ['warn'],
    }, eslintConfig)

    return source
}
