document.addEventListener('DOMContentLoaded', function() {
    // Get button elements
    const incrementBtn = document.getElementById('incrementBtn');
    const decrementBtn = document.getElementById('decrementBtn');
    const createVersionBtn = document.getElementById('createVersionBtn');
    const status = document.getElementById('status');

    // Function to get project prefix from URL
    function getProjectPrefix(url) {
        if (!url) return 'Admin';
        
        // Extract project key from URL
        const projectMatch = url.match(/\/projects\/([^/?]+)/);
        if (!projectMatch) return 'Admin';

        const projectKey = projectMatch[1];
        
        // Map project keys to their prefixes
        const prefixMap = {
            'LAA': 'LAA',
            'ADM': 'Admin',
            'OCD': 'Student'
        };

        return prefixMap[projectKey] || 'Admin';
    }

    // Function to get description prefix from URL
    function getDescriptionPrefix(url) {
        if (!url) return 'Admin';

        // Extract project key from URL
        const projectMatch = url.match(/\/projects\/([^/?]+)/);
        if (!projectMatch) return 'Admin';

        const projectKey = projectMatch[1];
        
        // Map project keys to their description prefixes
        const prefixMap = {
            'LAA': 'LAA',
            'ADM': 'Admin',
            'OCD': 'OCD'
        };

        return prefixMap[projectKey] || 'Admin';
    }

    // Function to format date consistently
    function formatDate(date) {
        // Force date to be interpreted in local timezone at midnight
        const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        return localDate.toISOString().split('T')[0];
    }

    // Function to calculate next dates based on latest release date
    function calculateNextDates(latestReleaseDate) {
        // Parse the latest release date and force it to local timezone
        const releaseDate = new Date(latestReleaseDate + 'T00:00:00');
        
        // Start date should be the day after the latest release
        const startDate = new Date(releaseDate);
        startDate.setDate(startDate.getDate() + 1);
        
        // End date should be the 19th of the next month
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);
        endDate.setDate(19);

        return {
            startDate: formatDate(startDate),
            releaseDate: formatDate(endDate)
        };
    }

    // Function to get latest version info from the page
    async function getLatestVersionInfo(tabId) {
        try {
            const result = await chrome.scripting.executeScript({
                target: { tabId },
                func: () => {
                    const rows = document.querySelectorAll('tr[data-rbd-draggable-id]');
                    if (!rows.length) return null;

                    let latestReleaseDate = new Date(0);
                    let latestVersionInfo = null;

                    // Go through all rows to find the latest release date
                    rows.forEach(row => {
                        const releaseDateCell = row.querySelector('td:nth-child(5)');
                        const descriptionCell = row.querySelector('td:nth-child(6)');
                        
                        if (releaseDateCell && descriptionCell) {
                            const releaseDate = new Date(releaseDateCell.textContent.trim());
                            
                            // Update latest if this release date is later
                            if (releaseDate > latestReleaseDate) {
                                latestReleaseDate = releaseDate;
                                
                                // Extract sprint number from description (e.g., "Admin S126" -> 126)
                                const description = descriptionCell.textContent.trim();
                                const sprintMatch = description.match(/S(\d+)/);
                                const currentSprint = sprintMatch ? parseInt(sprintMatch[1]) : null;

                                latestVersionInfo = {
                                    releaseDate: releaseDate.toISOString().split('T')[0],
                                    currentSprint: currentSprint
                                };
                            }
                        }
                    });

                    return latestVersionInfo;
                }
            });
            
            return result[0].result;
        } catch (error) {
            console.error('Error getting version info:', error);
            return null;
        }
    }

    // Function to update version info initialization to use latest release date
    async function initializeVersionInfo(tabId) {
        const latestInfo = await getLatestVersionInfo(tabId);
        if (!latestInfo) return null;

        const dates = calculateNextDates(latestInfo.releaseDate);
        return {
            sprintNumber: latestInfo.currentSprint + 1,
            versionName: `${getProjectPrefix()}_${latestInfo.currentSprint + 1}.0.0`,
            startDate: dates.startDate,
            endDate: dates.releaseDate,
            description: `${getDescriptionPrefix()} S${latestInfo.currentSprint + 1}`
        };
    }

    // Function to update version info when incrementing/decrementing
    function updateVersionInfo(increment = true) {
        const currentEndDate = versionInfo.endDate;
        
        if (increment) {
            versionInfo.sprintNumber++;
        } else if (versionInfo.sprintNumber > 1) {
            versionInfo.sprintNumber--;
        }

        const dates = calculateNextDates(currentEndDate);
        const prefix = getProjectPrefix(currentTab?.url);
        versionInfo.versionName = `${prefix}_${versionInfo.sprintNumber}.0.0`;
        versionInfo.startDate = dates.startDate;
        versionInfo.endDate = dates.releaseDate;
        versionInfo.description = `${getDescriptionPrefix(currentTab?.url)} S${versionInfo.sprintNumber}`;
        
        updatePreviewDisplay();
    }

    // Function to update preview display
    function updatePreviewDisplay() {
        document.getElementById('versionName').textContent = versionInfo.versionName;
        document.getElementById('startDate').textContent = versionInfo.startDate;
        document.getElementById('endDate').textContent = versionInfo.endDate;
        document.getElementById('description').textContent = versionInfo.description;
    }

    // Function to update preview
    async function updatePreview() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) return;

            currentTab = tab; // Store current tab for reference
            const prefix = getProjectPrefix(tab.url);
            const descPrefix = getDescriptionPrefix(tab.url);
            
            // Update version info
            const latestVersionInfo = await getLatestVersionInfo(tab.id);
            if (latestVersionInfo) {
                const { releaseDate, currentSprint } = latestVersionInfo;
                const nextDates = calculateNextDates(releaseDate);
                
                versionInfo = {
                    versionName: `${prefix}_${currentSprint + 1}.0.0`,
                    startDate: nextDates.startDate,
                    endDate: nextDates.releaseDate,
                    description: `${descPrefix} S${currentSprint + 1}`,
                    sprintNumber: currentSprint + 1
                };
            } else {
                versionInfo = {
                    versionName: `${prefix}_${versionInfo.sprintNumber}.0.0`,
                    startDate: versionInfo.startDate,
                    endDate: versionInfo.endDate,
                    description: `${getDescriptionPrefix(currentTab?.url)} S${versionInfo.sprintNumber}`,
                    sprintNumber: versionInfo.sprintNumber
                };
            }

            updatePreviewDisplay();
        } catch (error) {
            console.error('Error updating preview:', error);
        }
    }

    // Function to adjust date by days
    function adjustDate(dateStr, days) {
        // Parse date string and force local timezone
        const date = new Date(dateStr + 'T00:00:00');
        date.setDate(date.getDate() + days);
        return formatDate(date);
    }

    // Add click handlers for version increment/decrement
    if (incrementBtn) {
        incrementBtn.addEventListener('click', function() {
            updateVersionInfo(true);
        });
    }

    if (decrementBtn) {
        decrementBtn.addEventListener('click', function() {
            updateVersionInfo(false);
        });
    }

    // Helper function to wait for an element
    async function waitForElement(selector, timeout = 5000) {
        const start = Date.now();
        
        while (Date.now() - start < timeout) {
            const element = document.querySelector(selector);
            if (element) return element;
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        return null;
    }

    // Add click handler for create version button
    if (createVersionBtn) {
        createVersionBtn.addEventListener('click', async function() {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tab?.id) throw new Error('No active tab found');

                status.textContent = 'Creating version...';
                status.className = 'status';
                status.style.display = 'block';

                // Execute the form filling script
                const result = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: async (info) => {
                        try {
                            // Wait a moment for any animations to complete
                            await new Promise(resolve => setTimeout(resolve, 500));

                            // Find the form elements
                            const nameInput = document.querySelector('input[name="name"]');
                            const descriptionInput = document.querySelector('textarea[name="description"]');
                            const saveButton = document.querySelector('button[data-testid="software-releases-release-modals-relay.common.ui.release-form-fields.button"]');

                            // Find date inputs - looking for the actual text inputs
                            const startDateInput = document.querySelector('input[id^="startDate-"]');
                            const releaseDateInput = document.querySelector('input[id^="releaseDate-"]');

                            if (!nameInput || !startDateInput || !releaseDateInput || !descriptionInput || !saveButton) {
                                const missing = [];
                                if (!nameInput) missing.push('name input');
                                if (!startDateInput) missing.push('start date input');
                                if (!releaseDateInput) missing.push('release date input');
                                if (!descriptionInput) missing.push('description input');
                                if (!saveButton) missing.push('save button');
                                throw new Error(`Missing form fields: ${missing.join(', ')}`);
                            }

                            // Fill name
                            nameInput.value = info.versionName;
                            nameInput.dispatchEvent(new Event('input', { bubbles: true }));

                            // Format dates
                            const formatDate = (dateStr) => {
                                const date = new Date(dateStr + 'T00:00:00');
                                return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
                            };

                            // Helper function to set date value
                            const setDateValue = async (input, dateStr) => {
                                const formattedDate = formatDate(dateStr);
                                
                                // Focus the input
                                input.focus();
                                input.click();
                                
                                // Set the value
                                input.value = formattedDate;
                                
                                // Trigger React's synthetic events
                                input.dispatchEvent(new Event('input', { bubbles: true }));
                                input.dispatchEvent(new Event('change', { bubbles: true }));
                                
                                // Press Enter to close the date picker
                                input.dispatchEvent(new KeyboardEvent('keydown', {
                                    bubbles: true,
                                    cancelable: true,
                                    key: 'Enter',
                                    keyCode: 13
                                }));
                                
                                // Wait a bit for the date picker to process
                                await new Promise(resolve => setTimeout(resolve, 100));
                                
                                // Blur the input
                                input.blur();
                            };

                            // Fill dates
                            await setDateValue(startDateInput, info.startDate);
                            await setDateValue(releaseDateInput, info.endDate);

                            // Fill description
                            descriptionInput.value = info.description;
                            descriptionInput.dispatchEvent(new Event('input', { bubbles: true }));

                            // Small delay before clicking save
                            await new Promise(resolve => setTimeout(resolve, 100));

                            // Click save
                            saveButton.click();

                            return { success: true };
                        } catch (error) {
                            console.error('Error:', error);
                            return { success: false, error: error.message };
                        }
                    },
                    args: [versionInfo]
                });

                const { success, error } = result[0].result;
                if (success) {
                    status.textContent = 'Version created successfully!';
                    status.className = 'status success';
                } else {
                    throw new Error(error || 'Unknown error occurred');
                }
            } catch (error) {
                console.error('Error:', error);
                status.textContent = `Error: ${error.message}`;
                status.className = 'status error';
            }
        });
    }

    // Add event listeners for date controls
    const startDateIncrementBtn = document.getElementById('startDateIncrementBtn');
    const startDateDecrementBtn = document.getElementById('startDateDecrementBtn');
    const endDateIncrementBtn = document.getElementById('endDateIncrementBtn');
    const endDateDecrementBtn = document.getElementById('endDateDecrementBtn');

    startDateIncrementBtn.addEventListener('click', () => {
        versionInfo.startDate = adjustDate(versionInfo.startDate, 1);
        updatePreviewDisplay();
    });

    startDateDecrementBtn.addEventListener('click', () => {
        versionInfo.startDate = adjustDate(versionInfo.startDate, -1);
        updatePreviewDisplay();
    });

    endDateIncrementBtn.addEventListener('click', () => {
        versionInfo.endDate = adjustDate(versionInfo.endDate, 1);
        updatePreviewDisplay();
    });

    endDateDecrementBtn.addEventListener('click', () => {
        versionInfo.endDate = adjustDate(versionInfo.endDate, -1);
        updatePreviewDisplay();
    });

    // Add the buttons to the DOM
    document.addEventListener('DOMContentLoaded', () => {
        const startDateContainer = document.getElementById('startDate').parentElement;
        const endDateContainer = document.getElementById('endDate').parentElement;

        const startDateControls = document.createElement('div');
        startDateControls.className = 'date-controls';
        startDateControls.appendChild(startDateDecrementBtn);
        startDateControls.appendChild(document.getElementById('startDate'));
        startDateControls.appendChild(startDateIncrementBtn);
        startDateContainer.appendChild(startDateControls);

        const endDateControls = document.createElement('div');
        endDateControls.className = 'date-controls';
        endDateControls.appendChild(endDateDecrementBtn);
        endDateControls.appendChild(document.getElementById('endDate'));
        endDateControls.appendChild(endDateIncrementBtn);
        endDateContainer.appendChild(endDateControls);
    });

    // Listen for tab updates
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.status === 'complete' && tab.url?.includes('atlassian.net')) {
            updatePreview();
        }
    });

    // Listen for tab activation
    chrome.tabs.onActivated.addListener((activeInfo) => {
        chrome.tabs.get(activeInfo.tabId, (tab) => {
            if (tab.url?.includes('atlassian.net')) {
                updatePreview();
            }
        });
    });

    // Initialize the preview
    updatePreview();
});
