# Copyright (c) 2026 PrimitiveHub corpus benign sample.
# SPDX-License-Identifier: MIT
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is furnished
# to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
"""Source-header benign sample.

This file's purpose is to exercise the v0.2.3 CCI-009 exemption
for license-family hits inside a source file's top-of-file header
region (first 40 lines). The MIT boilerplate above sits at lines
4-15 and should be skipped by the detector.

Body content below the header carries no license boilerplate.
"""


def example() -> str:
    return "ordinary function body"
