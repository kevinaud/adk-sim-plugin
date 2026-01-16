#!/bin/bash

set -o allexport && . .env && set +o allexport && .venv/bin/python run_with_recorder.py run --replay replay.json fomc_research
