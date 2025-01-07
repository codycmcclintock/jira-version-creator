# Jira Version Creator

A Chrome extension that automates the creation of version entries in Jira, specifically designed for managing sprint versions across different projects (OCD, LAA, Admin).

## Features

- **Automatic Version Name Generation**: Creates version names in the format `PREFIX_NUMBER.0.0`
- **Smart Date Handling**: Automatically calculates sprint dates
- **Description Formatting**: Properly formats descriptions (e.g., "OCD S127", "LAA S127", "Admin S127")
- **Form Auto-Population**: Automatically fills in all required fields in the Jira version creation form
- **Project Support**: Supports multiple projects including OCD, LAA, and Admin

## Installation

1. Clone this repository or download the ZIP file
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory

## Usage

1. Navigate to your Jira project's version page
2. Click the extension icon in your Chrome toolbar
3. Fill in the required information:
   - Sprint number
   - Start date
   - Release date
4. Click "Create Version"

The extension will automatically:
- Generate the correct version name
- Set the start and release dates
- Format the description appropriately
- Create the version in Jira

## Development

### Project Structure
- `manifest.json`: Extension configuration
- `popup.html`: Extension popup interface
- `popup.js`: Main extension logic
- `styles.css`: Extension styling
- `background.js`: Background script for Chrome extension
- `content.js`: Content script for interacting with Jira pages

### Building and Testing
1. Make your changes
2. Test locally by loading the unpacked extension
3. Verify all features work as expected

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
