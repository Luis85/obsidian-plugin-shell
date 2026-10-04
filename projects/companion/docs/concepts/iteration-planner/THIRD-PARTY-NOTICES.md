# Third-party notices and provenance

The committed source subset has no third-party JavaScript/CSS runtime dependencies, bundled fonts or remote assets. Its UI helpers use system fonts and locally authored inline SVG paths. Example people, capacity values, backlog items and delivery notes are synthetic.

The source and test code uses Node.js built-ins. Node.js is not redistributed. The domain tests use Node's built-in test runner. No dependency or root lockfile is changed by this concept transfer.

The build script is retained from the separately delivered full prototype. In that package it builds an HTML artifact using browser APIs, including native gzip decompression, and content hashes for its Content Security Policy. In this partial checkout the build cannot finish because two required source modules are absent. The HTML and externally provisioned browser test runtime are not included here.

No private email, personal vault contents, credentials or secret is embedded in the synthetic example data. This concept is not affiliated with or endorsed by the Scrum Guide authors. Its one-increment-report-per-iteration convention is a product reporting choice, not a restriction on the number of technical increments a team can create.
