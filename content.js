// Prevent multiple injections
if (window.jiraHelperLoaded) {
    console.log('Jira Helper already loaded, skipping initialization');
} else {
    window.jiraHelperLoaded = true;
    console.log('Jira Helper content script loaded');

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script received message:', request);

    if (request.action === 'createVersion') {
        handleCreateVersion(request.versionInfo)
            .then(success => {
                console.log('Version creation result:', success);
                sendResponse({ success });
            })
            .catch(error => {
                console.error('Error creating version:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }
});

async function handleCreateVersion(versionInfo) {
    try {
        console.log('Creating version with info:', versionInfo);

        // Find and click the Create Version button
        const createButton = document.querySelector('[data-testid="project-directories.versions.main.add-version.create-button"]');
        if (!createButton) {
            throw new Error('Create version button not found');
        }
        createButton.click();
        console.log('Clicked create button');

        // Wait for modal to appear
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Find form elements
        const nameInput = document.querySelector('input[name="name"]');
        const startDateInput = document.querySelector('input[name="startDate"]');
        const releaseDateInput = document.querySelector('input[name="releaseDate"]');
        const descriptionInput = document.querySelector('textarea[name="description"]');

        if (!nameInput || !startDateInput || !releaseDateInput || !descriptionInput) {
            throw new Error('Form elements not found');
        }

        // Format dates as MM/DD/YYYY
        const formatDate = (dateStr) => {
            const date = new Date(dateStr);
            return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
        };

        // Fill in form fields
        nameInput.value = versionInfo.versionName;
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));
        console.log('Filled name:', versionInfo.versionName);

        startDateInput.value = formatDate(versionInfo.startDate);
        startDateInput.dispatchEvent(new Event('input', { bubbles: true }));
        console.log('Filled start date:', formatDate(versionInfo.startDate));

        releaseDateInput.value = formatDate(versionInfo.endDate);
        releaseDateInput.dispatchEvent(new Event('input', { bubbles: true }));
        console.log('Filled release date:', formatDate(versionInfo.endDate));

        descriptionInput.value = versionInfo.description;
        descriptionInput.dispatchEvent(new Event('input', { bubbles: true }));
        console.log('Filled description:', versionInfo.description);

        // Wait for form to process
        await new Promise(resolve => setTimeout(resolve, 500));

        // Click save button
        const saveButton = document.querySelector('button[type="submit"]');
        if (!saveButton) {
            throw new Error('Save button not found');
        }
        saveButton.click();
        console.log('Clicked save button');

        return true;
    } catch (error) {
        console.error('Error in handleCreateVersion:', error);
        throw error;
    }
}

// Project configurations
const PROJECT_CONFIGS = {
    ADM: {
        name: 'Admin',
        nameTemplate: 'Admin_{sprint}.0.0',
        descriptionTemplate: 'Admin S{sprint}'
    },
    OCD: {
        name: 'Student',
        nameTemplate: 'Student_{sprint}.0.0',
        descriptionTemplate: 'Student S{sprint}'
    },
    LAA: {
        name: 'LAA',
        nameTemplate: 'LAA_{sprint}.0.0',
        descriptionTemplate: 'LAA S{sprint}'
    }
};

// Detect current project from URL
function detectProject() {
    const url = window.location.href;
    console.log('JIRA Version Helper: Checking URL:', url);
    
    // Check for project identifiers in the URL or breadcrumb
    for (const project of ['ADM', 'OCD', 'LAA']) {
        // Check URL patterns
        if (url.includes(`/browse/${project}`) || 
            url.includes(`/projects/${project}`) ||
            url.includes(`${project.toLowerCase()} Portal`) ||
            document.querySelector(`a[href*="/browse/${project}"]`)) {
            return project;
        }
    }
    return null;
}

// Parse version number from string (e.g., "Admin_126.0.0" -> 126)
function parseVersionNumber(versionString) {
    const match = versionString.match(/(\d+)\.0\.0$/);
    return match ? parseInt(match[1]) : null;
}

// Parse sprint number from version description
function parseSprintNumber(description) {
    const match = description.match(/S(\d+)/);
    return match ? parseInt(match[1]) : null;
}

// Parse a date string in the format "Month DD, YYYY"
function parseDate(dateStr) {
    console.log('Parsing date string:', dateStr);
    const months = {
        'January': 0, 'February': 1, 'March': 2, 'April': 3, 'May': 4, 'June': 5,
        'July': 6, 'August': 7, 'September': 8, 'October': 9, 'November': 10, 'December': 11
    };

    const parts = dateStr.match(/(\w+)\s+(\d+),\s+(\d{4})/);
    if (!parts) {
        console.error('Could not parse date string:', dateStr);
        return null;
    }

    const [, month, day, year] = parts;
    const monthIndex = months[month];
    if (monthIndex === undefined) {
        console.error('Invalid month in date string:', month);
        return null;
    }

    const date = new Date(parseInt(year), monthIndex, parseInt(day));
    console.log('Parsed date:', date);
    return date;
}

// Format date in "Month DD, YYYY" format
function formatDate(date) {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

// Calculate sprint duration in days
function calculateSprintDuration(startDate, releaseDate) {
    const start = parseDate(startDate);
    const end = parseDate(releaseDate);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Find most recent version
async function findMostRecentVersion() {
    console.log('Finding most recent version...');
    
    const versionRows = Array.from(document.querySelectorAll('tr')).filter(row => {
        const versionCell = row.querySelector('td:first-child a');
        return versionCell && versionCell.textContent.trim().match(/^(Admin|OCD|LAA)_\d+\.0\.0$/);
    });

    if (versionRows.length === 0) {
        throw new Error('No existing versions found');
    }

    // Sort versions by number
    versionRows.sort((a, b) => {
        const versionA = parseVersionNumber(a.querySelector('td:first-child a').textContent.trim());
        const versionB = parseVersionNumber(b.querySelector('td:first-child a').textContent.trim());
        return versionB - versionA;
    });

    const latestRow = versionRows[0];
    const latestVersion = latestRow.querySelector('td:first-child a').textContent.trim();
    const latestNumber = parseVersionNumber(latestVersion);

    // Get all cells
    const cells = Array.from(latestRow.querySelectorAll('td'));
    
    // Release date is in the fifth column (index 4)
    const releaseDateText = cells[4]?.textContent?.trim();
    console.log('Found release date text:', releaseDateText);

    return {
        sprintNumber: latestNumber + 1,
        releaseDate: releaseDateText
    };
}

// Calculate dates based on previous release date
function calculateDates(lastReleaseDate) {
    console.log('Calculating dates from:', lastReleaseDate);

    // Parse the last release date
    const lastRelease = parseDate(lastReleaseDate);
    if (!lastRelease) {
        console.error('Could not parse last release date');
        return {
            startDate: 'Error parsing date',
            releaseDate: 'Error parsing date'
        };
    }

    // Start date is the day after the last release
    const startDate = new Date(lastRelease);
    startDate.setDate(startDate.getDate() + 1);
    
    // Calculate release date (4 weeks from start date)
    const releaseDate = new Date(startDate);
    releaseDate.setDate(releaseDate.getDate() + (4 * 7)); // Add 4 weeks
    
    // Adjust to the following Sunday if not already a Sunday
    const daysUntilSunday = (7 - releaseDate.getDay()) % 7;
    if (daysUntilSunday > 0) {
        releaseDate.setDate(releaseDate.getDate() + daysUntilSunday);
    }

    // Format dates for display
    const formattedStartDate = formatDate(startDate);
    const formattedReleaseDate = formatDate(releaseDate);

    console.log('Calculated dates:', {
        startDate: formattedStartDate,
        releaseDate: formattedReleaseDate
    });

    return {
        startDate: formattedStartDate,
        releaseDate: formattedReleaseDate
    };
}

// Check if we're on the releases page
function isOnReleasesPage() {
    const url = window.location.href;
    console.log('JIRA Version Helper: Checking if on releases page. URL:', url);
    
    // Check multiple indicators that we're on the releases page
    const isReleasesPage = 
        url.includes('/releases') || 
        url.endsWith('/releases') ||
        document.querySelector('h1')?.textContent.includes('Releases') ||
        document.querySelector('button')?.textContent.includes('Create version');
        
    console.log('JIRA Version Helper: Is releases page?', isReleasesPage);
    return isReleasesPage;
}

// Utility function to wait for an element to be present in the DOM
const waitForElement = (selector, timeout = 5000) => {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const checkElement = () => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
            } else if (Date.now() - startTime >= timeout) {
                reject(new Error(`Element ${selector} not found after ${timeout}ms`));
            } else {
                setTimeout(checkElement, 100);
            }
        };
        
        checkElement();
    });
};

// Function to navigate to Releases page
async function navigateToReleases() {
    try {
        // Click on Releases in the sidebar
        const releasesLink = await waitForElement('a[href*="/projects/"][href*="/versions"]');
        releasesLink.click();
        return true;
    } catch (error) {
        console.error('Failed to navigate to Releases:', error);
        return false;
    }
}

// Function to click Create Version button
async function clickCreateVersion() {
    try {
        // Wait for and click the Create Version button
        const createButton = await waitForElement('button[data-testid="versions-create-version-button"]');
        createButton.click();
        return true;
    } catch (error) {
        console.error('Failed to click Create Version:', error);
        return false;
    }
}

// Function to fill out the Create Version form
async function fillVersionForm(data) {
    try {
        // Wait for form elements
        const nameInput = await waitForElement('input[name="name"]');
        const startDateInput = await waitForElement('input[name="startDate"]');
        const releaseDateInput = await waitForElement('input[name="releaseDate"]');
        const descriptionInput = await waitForElement('textarea[name="description"]');
        
        // Fill out the form
        nameInput.value = data.name;
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));
        
        startDateInput.value = data.startDate;
        startDateInput.dispatchEvent(new Event('input', { bubbles: true }));
        
        releaseDateInput.value = data.releaseDate;
        releaseDateInput.dispatchEvent(new Event('input', { bubbles: true }));
        
        descriptionInput.value = data.description;
        descriptionInput.dispatchEvent(new Event('input', { bubbles: true }));
        
        return true;
    } catch (error) {
        console.error('Failed to fill form:', error);
        return false;
    }
}

// Function to submit the form
async function submitVersionForm() {
    try {
        const submitButton = await waitForElement('button[type="submit"]');
        submitButton.click();
        return true;
    } catch (error) {
        console.error('Failed to submit form:', error);
        return false;
    }
}

// Main function to create a version
async function createJiraVersion(versionData) {
    try {
        await navigateToReleases();
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for navigation
        
        await clickCreateVersion();
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for modal
        
        await fillVersionForm(versionData);
        
        // Don't submit automatically - let user review
        console.log('Form filled. Ready for review.');
        
        return true;
    } catch (error) {
        console.error('Failed to create version:', error);
        return false;
    }
}

// Show preview modal with increment/decrement controls
async function showPreviewModal(project, initialSprintNumber, dates) {
    const config = PROJECT_CONFIGS[project];
    let currentSprintNumber = initialSprintNumber;

    function updateVersionDisplay() {
        const versionName = config.nameTemplate.replace('{sprint}', currentSprintNumber);
        const description = config.descriptionTemplate.replace('{sprint}', currentSprintNumber);
        document.getElementById('jvh-version-name').textContent = versionName;
        document.getElementById('jvh-description').textContent = description;
        document.getElementById('jvh-sprint-number').textContent = currentSprintNumber;
    }

    const sprintDuration = calculateSprintDuration(dates.startDate, dates.releaseDate);

    const modalHtml = `
        <div class="jvh-modal-overlay">
            <div class="jvh-modal">
                <h2><i class="fas fa-wand-magic-sparkles"></i> Create Version Preview</h2>
                
                <div class="jvh-field">
                    <label>Sprint Number</label>
                    <div class="jvh-number-control">
                        <button class="jvh-button jvh-button-secondary" id="jvh-decrement">
                            <i class="fas fa-minus"></i>
                        </button>
                        <span id="jvh-sprint-number" class="jvh-number-display"></span>
                        <button class="jvh-button jvh-button-secondary" id="jvh-increment">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                </div>

                <div class="jvh-field">
                    <label>Version Name</label>
                    <div class="value" id="jvh-version-name"></div>
                </div>

                <div class="jvh-field">
                    <label>Start Date</label>
                    <div class="value">${dates.startDate}</div>
                </div>

                <div class="jvh-field">
                    <label>Release Date</label>
                    <div class="value">${dates.releaseDate}</div>
                </div>

                <div class="jvh-field">
                    <label>Description</label>
                    <div class="value" id="jvh-description"></div>
                </div>

                <div class="jvh-modal-footer">
                    <div class="jvh-duration-label">
                        <i class="fas fa-calendar-day"></i>
                        Sprint Days: ${sprintDuration}
                    </div>
                    <div class="jvh-actions">
                        <button class="jvh-button jvh-button-secondary" id="jvh-cancel">
                            <i class="fas fa-times"></i> Cancel
                        </button>
                        <button class="jvh-button jvh-button-primary" id="jvh-create">
                            <i class="fas fa-wand-magic-sparkles"></i> Create Version
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Add modal to page
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer);

    // Add styles
    const styleEl = document.createElement('style');
    styleEl.textContent = `
.jvh-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
}

.jvh-modal {
    background: white;
    padding: 24px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    width: 400px;
    max-width: 90vw;
}

.jvh-modal h2 {
    margin: 0 0 16px;
    font-size: 20px;
    font-weight: 500;
    color: #172B4D;
    display: flex;
    align-items: center;
    gap: 8px;
}

.jvh-modal h2 i {
    font-size: 24px;
    color: #0052CC;
}

.jvh-field {
    margin-bottom: 16px;
}

.jvh-field label {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: #172B4D;
    margin-bottom: 4px;
}

.jvh-field .value {
    font-size: 14px;
    color: #42526E;
    padding: 8px;
    background: #F4F5F7;
    border-radius: 4px;
}

.jvh-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 24px;
}

.jvh-button {
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    display: flex;
    align-items: center;
    gap: 8px;
}

.jvh-button-secondary {
    background: #F4F5F7;
    color: #42526E;
}

.jvh-button-primary {
    background: #0052CC;
    color: white;
}

.jvh-button i {
    font-size: 16px;
}

.jvh-loading {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid #ffffff;
    border-radius: 50%;
    border-top-color: transparent;
    animation: jvh-spin 1s linear infinite;
}

@keyframes jvh-spin {
    to {
        transform: rotate(360deg);
    }
}

.jvh-number-control {
    display: flex;
    align-items: center;
    gap: 12px;
    background: #F4F5F7;
    padding: 8px;
    border-radius: 4px;
}
    
.jvh-number-display {
    font-size: 16px;
    font-weight: 500;
    color: #172B4D;
    min-width: 40px;
    text-align: center;
}
    
.jvh-button-secondary {
    padding: 4px 8px;
}
    
.jvh-button-secondary:hover {
    background: #EBECF0;
}

.jvh-modal-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 24px;
}

.jvh-duration-label {
    color: var(--ds-text-subtle, #6B778C);
    font-size: 12px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 4px;
}

.jvh-duration-label i {
    font-size: 12px;
}

.jvh-actions {
    display: flex;
    gap: 8px;
}
`;
    document.head.appendChild(styleEl);

    // Initialize display
    updateVersionDisplay();

    // Handle button clicks
    return new Promise((resolve) => {
        const modal = modalContainer.querySelector('.jvh-modal-overlay');
        const createBtn = document.getElementById('jvh-create');
        const cancelBtn = document.getElementById('jvh-cancel');
        const incrementBtn = document.getElementById('jvh-increment');
        const decrementBtn = document.getElementById('jvh-decrement');

        incrementBtn.addEventListener('click', () => {
            currentSprintNumber++;
            updateVersionDisplay();
        });

        decrementBtn.addEventListener('click', () => {
            if (currentSprintNumber > 1) {
                currentSprintNumber--;
                updateVersionDisplay();
            }
        });

        createBtn.addEventListener('click', () => {
            resolve({ proceed: true, sprintNumber: currentSprintNumber });
            modal.remove();
        });

        cancelBtn.addEventListener('click', () => {
            resolve({ proceed: false });
            modal.remove();
        });
    });
}

// Function to simulate a click event
function simulateClick(element) {
  const event = new MouseEvent('click', {
    view: window,
    bubbles: true,
    cancelable: true
  });
  element.dispatchEvent(event);
}

// Function to create a new version
function createVersion(versionName, description) {
  // Find and click the "Create Version" button
  const createVersionButton = document.querySelector('button#create-version');
  if (createVersionButton) {
    simulateClick(createVersionButton);

    // Wait for the modal to appear and populate it
    setTimeout(() => {
      const versionNameInput = document.querySelector('input#version-name');
      const descriptionInput = document.querySelector('textarea#version-description');
      const submitButton = document.querySelector('button#submit-version');

      if (versionNameInput && descriptionInput && submitButton) {
        versionNameInput.value = versionName;
        descriptionInput.value = description;

        // Show a preview before submitting
        alert(`Preview:\nVersion Name: ${versionName}\nDescription: ${description}`);

        // Uncomment the next line to actually submit the form
        // simulateClick(submitButton);
      }
    }, 1000); // Adjust timeout as needed
  }
}

// Example usage
createVersion('1.0.0', 'Initial release version.');

// Show loading state
function setLoading(button, isLoading) {
    if (isLoading) {
        button.innerHTML = '<span class="jvh-loading"></span> Creating...';
        button.disabled = true;
    } else {
        button.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> Create Version';
        button.disabled = false;
    }
}

// Main function to handle version creation
async function handleVersionCreation() {
    try {
        console.log('Starting version creation process...');
        
        // Inject required styles and dependencies
        injectDependencies();

        // Get current project and version info
        const project = detectProject();
        if (!project) {
            throw new Error('Could not detect current project');
        }

        // Find most recent version
        const { sprintNumber, releaseDate } = await findMostRecentVersion();
        const dates = calculateDates(releaseDate);

        // Show preview modal first
        const result = await showPreviewModal(project, sprintNumber, dates);
        if (!result.proceed) {
            console.log('User cancelled version creation');
            return;
        }

        // Find and click create version button
        const createButton = await waitForElement('button:contains("Create version")');
        if (!createButton) {
            throw new Error('Create version button not found');
        }

        // Click the button and wait a moment
        createButton.click();
        await new Promise(resolve => setTimeout(resolve, 500));

        // Fill the form
        await fillCreateVersionForm(project, result.sprintNumber, dates);

    } catch (error) {
        console.error('Error in version creation:', error);
        alert('Error creating version: ' + error.message);
    }
}

// Update the fillCreateVersionForm function
async function fillCreateVersionForm(project, sprintNumber, dates) {
    try {
        console.log('Starting form fill process...');
        
        // Wait for modal dialog
        const modal = await waitForElement('[role="dialog"]');
        if (!modal) {
            throw new Error('Version creation modal not found');
        }

        // Get project config
        const config = PROJECT_CONFIGS[project];
        if (!config) {
            throw new Error('Project configuration not found');
        }

        // Wait for and fill name field
        const nameInput = await waitForElement('input[name="name"]');
        if (nameInput) {
            const versionName = config.nameTemplate.replace('{sprint}', sprintNumber);
            nameInput.value = versionName;
            nameInput.dispatchEvent(new Event('input', { bubbles: true }));
            nameInput.dispatchEvent(new Event('change', { bubbles: true }));
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        // Wait for and fill start date
        const startDateInput = await waitForElement('input[id*="start"]');
        if (startDateInput) {
            startDateInput.value = dates.startDate;
            startDateInput.dispatchEvent(new Event('input', { bubbles: true }));
            startDateInput.dispatchEvent(new Event('change', { bubbles: true }));
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        // Wait for and fill release date
        const releaseDateInput = await waitForElement('input[id*="release"]');
        if (releaseDateInput) {
            releaseDateInput.value = dates.releaseDate;
            releaseDateInput.dispatchEvent(new Event('input', { bubbles: true }));
            releaseDateInput.dispatchEvent(new Event('change', { bubbles: true }));
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        // Wait for and fill description
        const descriptionInput = await waitForElement('textarea');
        if (descriptionInput) {
            const description = config.descriptionTemplate.replace('{sprint}', sprintNumber);
            descriptionInput.value = description;
            descriptionInput.dispatchEvent(new Event('input', { bubbles: true }));
            descriptionInput.dispatchEvent(new Event('change', { bubbles: true }));
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        // Find and click save button
        const saveButton = await waitForElement('button[type="submit"], button:contains("Save")');
        if (saveButton) {
            saveButton.click();
        } else {
            throw new Error('Save button not found');
        }

    } catch (error) {
        console.error('Error filling form:', error);
        throw error;
    }
}

// Inject required styles
const styles = `
.jvh-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
}

.jvh-modal {
    background: white;
    padding: 24px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    width: 400px;
    max-width: 90vw;
}

.jvh-modal h2 {
    margin: 0 0 16px;
    font-size: 20px;
    font-weight: 500;
    color: #172B4D;
    display: flex;
    align-items: center;
    gap: 8px;
}

.jvh-modal h2 i {
    font-size: 24px;
    color: #0052CC;
}

.jvh-field {
    margin-bottom: 16px;
}

.jvh-field label {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: #172B4D;
    margin-bottom: 4px;
}

.jvh-field .value {
    font-size: 14px;
    color: #42526E;
    padding: 8px;
    background: #F4F5F7;
    border-radius: 4px;
}

.jvh-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 24px;
}

.jvh-button {
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    display: flex;
    align-items: center;
    gap: 8px;
}

.jvh-button-secondary {
    background: #F4F5F7;
    color: #42526E;
}

.jvh-button-primary {
    background: #0052CC;
    color: white;
}

.jvh-button i {
    font-size: 16px;
}

.jvh-loading {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid #ffffff;
    border-radius: 50%;
    border-top-color: transparent;
    animation: jvh-spin 1s linear infinite;
}

@keyframes jvh-spin {
    to {
        transform: rotate(360deg);
    }
}

.jvh-number-control {
    display: flex;
    align-items: center;
    gap: 12px;
    background: #F4F5F7;
    padding: 8px;
    border-radius: 4px;
}
    
.jvh-number-display {
    font-size: 16px;
    font-weight: 500;
    color: #172B4D;
    min-width: 40px;
    text-align: center;
}
    
.jvh-button-secondary {
    padding: 4px 8px;
}
    
.jvh-button-secondary:hover {
    background: #EBECF0;
}

.jvh-modal-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 24px;
}

.jvh-duration-label {
    color: var(--ds-text-subtle, #6B778C);
    font-size: 12px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 4px;
}

.jvh-duration-label i {
    font-size: 12px;
}

.jvh-actions {
    display: flex;
    gap: 8px;
}
`;

// Add styles for number control
const numberControlStyles = `
.jvh-number-control {
    display: flex;
    align-items: center;
    gap: 12px;
    background: #F4F5F7;
    padding: 8px;
    border-radius: 4px;
}
    
.jvh-number-display {
    font-size: 16px;
    font-weight: 500;
    color: #172B4D;
    min-width: 40px;
    text-align: center;
}
    
.jvh-button-secondary {
    padding: 4px 8px;
}
    
.jvh-button-secondary:hover {
    background: #EBECF0;
}
`;

// Add styles for duration badge
const durationBadgeStyles = `
.jvh-modal-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 24px;
}

.jvh-duration-label {
    color: var(--ds-text-subtle, #6B778C);
    font-size: 12px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 4px;
}

.jvh-duration-label i {
    font-size: 12px;
}

.jvh-actions {
    display: flex;
    gap: 8px;
}
`;

// Inject Font Awesome for icons
function injectDependencies() {
    // Add styles
    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);

    // Add Font Awesome
    const fontAwesome = document.createElement('link');
    fontAwesome.rel = 'stylesheet';
    fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css';
    document.head.appendChild(fontAwesome);
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'createVersion') {
        handleVersionCreation().catch(error => {
            console.error('JIRA Version Helper: Error:', error);
            alert('Error creating version: ' + error.message);
        });
    }
});

// Utility function to wait for an element
const waitForElement = (selector, timeout = 5000) => {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const checkElement = () => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
            } else if (Date.now() - startTime >= timeout) {
                reject(new Error(`Element ${selector} not found after ${timeout}ms`));
            } else {
                setTimeout(checkElement, 100);
            }
        };
        
        checkElement();
    });
};

// Get the next version name based on existing versions
function getNextVersionName() {
    const versionElements = document.querySelectorAll('[data-testid="versions-table"] [data-testid="versions-table.row"]');
    let latestVersion = '0.0.0';
    
    versionElements.forEach(element => {
        const versionText = element.textContent;
        const versionMatch = versionText.match(/\d+\.\d+\.\d+/);
        if (versionMatch) {
            const version = versionMatch[0];
            if (version > latestVersion) {
                latestVersion = version;
            }
        }
    });
    
    const [major, minor, patch] = latestVersion.split('.').map(Number);
    return `${major}.${minor}.${patch + 1}`;
}

// Calculate dates
function calculateDates() {
    const now = new Date();
    const startDate = now.toISOString().split('T')[0]; // Today
    
    // Set release date to next Friday
    const releaseDate = new Date(now);
    releaseDate.setDate(releaseDate.getDate() + (5 + 7 - releaseDate.getDay()) % 7);
    
    return {
        startDate,
        releaseDate: releaseDate.toISOString().split('T')[0]
    };
}

// Main function to create version
async function createVersion() {
    try {
        // Click Create Version button
        const createButton = await waitForElement('button[data-testid="versions-create-version-button"]');
        createButton.click();
        
        // Wait for modal and form elements
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Get next version name and dates
        const nextVersion = getNextVersionName();
        const dates = calculateDates();
        
        // Fill form fields
        const nameInput = await waitForElement('input[name="name"]');
        const startDateInput = await waitForElement('input[name="startDate"]');
        const releaseDateInput = await waitForElement('input[name="releaseDate"]');
        const descriptionInput = await waitForElement('textarea[name="description"]');
        
        // Set values and dispatch input events
        nameInput.value = nextVersion;
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));
        
        startDateInput.value = dates.startDate;
        startDateInput.dispatchEvent(new Event('input', { bubbles: true }));
        
        releaseDateInput.value = dates.releaseDate;
        releaseDateInput.dispatchEvent(new Event('input', { bubbles: true }));
        
        descriptionInput.value = `Version ${nextVersion}`;
        descriptionInput.dispatchEvent(new Event('input', { bubbles: true }));
        
        return true;
    } catch (error) {
        console.error('Error creating version:', error);
        return false;
    }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Received message:', request);

    if (request.action === 'getVersionDetails') {
        getLastVersionInfo()
            .then(versionInfo => {
                if (!versionInfo) {
                    sendResponse({ success: false, error: 'No version info found' });
                    return;
                }
                sendResponse(versionInfo);
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }

    if (request.action === 'createVersion') {
        (async () => {
            try {
                console.log('Creating version with info:', request.versionInfo);

                // Click the create version button
                const createButton = await waitForElement('[data-testid="project-directories.versions.main.add-version.create-button"]');
                if (!createButton) {
                    throw new Error('Create version button not found');
                }
                createButton.click();

                // Wait for modal and fill form
                await new Promise(resolve => setTimeout(resolve, 500));
                const success = await fillVersionForm(request.versionInfo);

                if (!success) {
                    throw new Error('Failed to fill version form');
                }

                // Click save button
                const saveButton = await waitForElement('button[type="submit"]');
                if (!saveButton) {
                    throw new Error('Save button not found');
                }
                saveButton.click();

                console.log('Version created successfully');
                sendResponse({ success: true });
            } catch (error) {
                console.error('Error creating version:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }
});

function parseDate(dateStr) {
    try {
        return new Date(dateStr);
    } catch (e) {
        console.error('Error parsing date:', dateStr, e);
        return null;
    }
}

async function getLastVersionInfo() {
    try {
        console.log('Getting last version info...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Find all rows with version information
        const rows = Array.from(document.querySelectorAll('tr')).filter(row => {
            return row.querySelector('a[href*="/versions/"]');
        });

        if (rows.length === 0) {
            console.error('No version rows found');
            return null;
        }

        // Get version information from each row
        const versions = [];
        for (const row of rows) {
            const cells = row.querySelectorAll('td');
            const versionName = row.querySelector('a[href*="/versions/"]')?.textContent.trim();
            let releaseDate = null;
            let description = null;

            // Find the release date and description cells
            cells.forEach(cell => {
                const text = cell.textContent.trim();
                if (/[A-Z][a-z]+ \d{1,2}, \d{4}/.test(text)) {
                    releaseDate = text;
                } else if (text.startsWith('Admin S')) {
                    description = text;
                }
            });

            if (versionName && releaseDate) {
                versions.push({
                    versionName,
                    releaseDate,
                    description,
                    releaseDateObj: parseDate(releaseDate)
                });
            }
        }

        console.log('Found versions:', versions);

        // Find the version with the closest future release date
        const now = new Date();
        versions.sort((a, b) => a.releaseDateObj - b.releaseDateObj);
        
        const futureVersions = versions.filter(v => v.releaseDateObj > now);
        const targetVersion = futureVersions[0] || versions[versions.length - 1];

        if (!targetVersion) {
            console.error('No valid version found');
            return null;
        }

        // Extract sprint number from description
        const sprintMatch = targetVersion.description?.match(/S(\d+)/);
        const sprintNumber = sprintMatch ? parseInt(sprintMatch[1]) : null;

        const result = {
            success: true,
            lastVersion: targetVersion.versionName,
            lastReleaseDate: targetVersion.releaseDate,
            description: targetVersion.description,
            sprintNumber: sprintNumber
        };

        console.log('Selected version info:', result);
        return result;
    } catch (error) {
        console.error('Error getting version info:', error);
        return null;
    }
}

// Function to wait for an element to appear
async function waitForElement(selector, timeout = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const element = document.querySelector(selector);
        if (element) {
            return element;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    return null;
}

// Function to fill the create version form
async function fillVersionForm(versionInfo) {
    try {
        console.log('Filling version form with:', versionInfo);

        // Wait for form elements
        const nameInput = await waitForElement('input[name="name"]');
        const startDateInput = await waitForElement('input[name="startDate"]');
        const releaseDateInput = await waitForElement('input[name="releaseDate"]');
        const descriptionInput = await waitForElement('textarea[name="description"]');

        if (!nameInput || !startDateInput || !releaseDateInput || !descriptionInput) {
            throw new Error('Form elements not found');
        }

        // Fill in the form
        nameInput.value = versionInfo.versionName;
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));

        // Convert dates to MM/DD/YYYY format
        const startDate = new Date(versionInfo.startDate);
        const releaseDate = new Date(versionInfo.endDate);

        startDateInput.value = `${startDate.getMonth() + 1}/${startDate.getDate()}/${startDate.getFullYear()}`;
        startDateInput.dispatchEvent(new Event('input', { bubbles: true }));

        releaseDateInput.value = `${releaseDate.getMonth() + 1}/${releaseDate.getDate()}/${releaseDate.getFullYear()}`;
        releaseDateInput.dispatchEvent(new Event('input', { bubbles: true }));

        descriptionInput.value = versionInfo.description;
        descriptionInput.dispatchEvent(new Event('input', { bubbles: true }));

        return true;
    } catch (error) {
        console.error('Error filling version form:', error);
        return false;
    }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Received message:', request);

    if (request.action === 'getVersionDetails') {
        getLastVersionInfo()
            .then(versionInfo => {
                if (!versionInfo) {
                    sendResponse({ success: false, error: 'No version info found' });
                    return;
                }
                sendResponse(versionInfo);
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }

    if (request.action === 'createVersion') {
        (async () => {
            try {
                console.log('Creating version with info:', request.versionInfo);

                // Click the create version button
                const createButton = await waitForElement('[data-testid="project-directories.versions.main.add-version.create-button"]');
                if (!createButton) {
                    throw new Error('Create version button not found');
                }
                createButton.click();

                // Wait for modal and fill form
                await new Promise(resolve => setTimeout(resolve, 500));
                const success = await fillVersionForm(request.versionInfo);

                if (!success) {
                    throw new Error('Failed to fill version form');
                }

                // Click save button
                const saveButton = await waitForElement('button[type="submit"]');
                if (!saveButton) {
                    throw new Error('Save button not found');
                }
                saveButton.click();

                console.log('Version created successfully');
                sendResponse({ success: true });
            } catch (error) {
                console.error('Error creating version:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }
});
