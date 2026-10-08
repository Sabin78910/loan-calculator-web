# Loan Calculator

EMI loan calculator with amortization schedule and total interest.

![CI](https://github.com/Sabin78910/loan-calculator-web/actions/workflows/ci.yml/badge.svg)
![Deploy](https://github.com/Sabin78910/loan-calculator-web/actions/workflows/deploy.yml/badge.svg)

**Live:** https://sabin78910.github.io/loan-calculator-web/

Built with React, TypeScript and Vite. Tested with Vitest and Testing Library.

## Develop (VS Code)
```bash
npm install
npm run dev     # http://localhost:5173
npm test
npm run build
```

## Automation (runs on GitHub, no laptop needed)
| Workflow | Trigger | What it does |
|---|---|---|
| CI | push / PR to main | lint, typecheck, tests, build, npm audit |
| Deploy to GitHub Pages | push to main | publishes the site |
| CodeQL | push / PR / weekly | security analysis |
| Dependabot | weekly | dependency update PRs |
