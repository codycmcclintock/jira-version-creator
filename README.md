# JIRA Version Helper Chrome Extension

This Chrome extension helps create new JIRA versions quickly with automated naming conventions and date calculations for different projects.

## Features

- Automatically detects the current JIRA project (Admin Portal, Student Portal, or Learning Assignment Architecture)
- Calculates the next sprint number based on existing versions
- Sets start date to the Monday after the previous release
- Sets release date to 4 weeks after the start date
- Automatically fills the version creation form with the correct naming conventions

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the directory containing this extension

## Usage

1. Navigate to your JIRA project's Releases page
2. Click the extension icon in your Chrome toolbar
3. The extension will automatically:
   - Detect the current project
   - Find the latest version number
   - Calculate the appropriate dates
   - Open and fill out the "Create version" form

## Project Naming Conventions

- Admin Portal (ADM):
  - Name format: Admin_[sprint].0.0
  - Description format: Admin S[sprint]
- Student Portal (OCD):
  - Name format: Student_[sprint].0.0
  - Description format: Student S[sprint]
- Learning Assignment Architecture (LAA):
  - Name format: LAA_[sprint].0.0
  - Description format: LAA S[sprint]

## Development

The extension uses Manifest V3 and consists of:
- manifest.json: Extension configuration
- content.js: Main logic for interacting with JIRA
- background.js: Handles extension icon clicks
- images/: Extension icons

## Requirements

- Google Chrome browser
- Access to JIRA instance
- Appropriate permissions to create versions in JIRA
