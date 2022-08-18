import fs from 'node:fs'

const files = fs.readdirSync(__dirname, { withFileTypes: true })

const filtered = files.filter(d =>
    d.isFile()
    && d.name !== "index.ts"
    && d.name.endsWith(".ts")
    && !d.name.startsWith(".")
    && !d.name.startsWith("_")
);

const rules = Object.fromEntries(filtered.map(d => ["custom/" + d.name.slice(0, -3), require("./" + d.name)]))

export = rules;
