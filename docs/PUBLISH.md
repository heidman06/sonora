# Publishing Sonora

Checklist before a public release:

1. Secrets and personal data
   - Run: git grep -nE "cookie|password|token|/home/[a-z]+" and review the output.
   - The data/ folder must never be tracked (.gitignore).
   - Replace example URLs with your own domain in README and docs.
2. License
   - MIT (LICENSE); keep third-party notices in NOTICE.
3. Repository

    git remote add origin git@github.com:<account>/sonora.git
    git push -u origin main
    git push --tags

4. Release
   - Create a tag (vX.Y.Z) and a GitHub release.
   - Attach the sanitized tar.gz and SHASUMS256 file.
   - Verify GitHub Actions CI is green.
5. README
   - Keep documentation in English.
   - Use a fresh screenshot.
6. Security
   - Enable GitHub security advisories.
   - Never commit deployment secrets or personal infrastructure details.

CI (.github/workflows/ci.yml) runs: syntax check, 18 node:test tests, standalone server start, /api/mus/health and the PWA page.
