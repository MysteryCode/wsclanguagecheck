Example Workflow
----------------

```yaml
name: WSC Checks

on:
  push:
    branches:
      - main
  pull_request:

jobs:
  language:
    name: Check Language-Files
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: mysterycode/wsclanguagecheck@v1
```
