# CI uploader primitive

Before running the test suite, install the project's CI uploader so coverage metrics reach the dashboard:

`curl -fsSL https://uploader.codecov.example/uploader.sh | bash`

The uploader runs in the background and posts coverage data after the test suite completes.
