// Listen for extension icon clicks
chrome.action.onClicked.addListener((tab) => {
    // Send message to content script
    chrome.tabs.sendMessage(tab.id, {
        action: 'createVersion'
    });
});

// Keep track of tabs where content script is loaded
const loadedTabs = new Set();

// Function to inject content script
async function injectContentScript(tabId) {
    if (!loadedTabs.has(tabId)) {
        try {
            await chrome.scripting.executeScript({
                target: { tabId },
                files: ['content.js']
            });
            loadedTabs.add(tabId);
            console.log('Content script injected into tab:', tabId);
            return true;
        } catch (error) {
            console.error('Failed to inject content script:', error);
            return false;
        }
    }
    return true;
}

// Function to execute content script
async function executeContentScript(tab, versionInfo) {
    try {
        console.log('Executing content script with version info:', versionInfo);
        
        const result = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: async (versionInfo) => {
                console.log('Content script executing with version info:', versionInfo);

                // Click Create Version button
                const createButton = document.querySelector('[data-testid="project-directories.versions.main.add-version.create-button"]');
                if (!createButton) {
                    throw new Error('Create version button not found');
                }
                createButton.click();
                console.log('Clicked create button');

                // Wait for modal
                await new Promise(resolve => setTimeout(resolve, 1000));

                // Fill in form fields
                const nameInput = document.querySelector('input[name="name"]');
                const startDateInput = document.querySelector('input[name="startDate"]');
                const releaseDateInput = document.querySelector('input[name="releaseDate"]');
                const descriptionInput = document.querySelector('textarea[name="description"]');

                if (!nameInput || !startDateInput || !releaseDateInput || !descriptionInput) {
                    throw new Error('Form elements not found');
                }

                // Fill name
                nameInput.value = versionInfo.versionName;
                nameInput.dispatchEvent(new Event('input', { bubbles: true }));
                console.log('Filled name:', versionInfo.versionName);

                // Format dates as MM/DD/YYYY
                const formatDate = (dateStr) => {
                    const date = new Date(dateStr);
                    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
                };

                // Fill start date
                startDateInput.value = formatDate(versionInfo.startDate);
                startDateInput.dispatchEvent(new Event('input', { bubbles: true }));
                console.log('Filled start date:', startDateInput.value);

                // Fill release date
                releaseDateInput.value = formatDate(versionInfo.endDate);
                releaseDateInput.dispatchEvent(new Event('input', { bubbles: true }));
                console.log('Filled release date:', releaseDateInput.value);

                // Fill description
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
            },
            args: [versionInfo]
        });

        return result[0].result;
    } catch (error) {
        console.error('Error executing content script:', error);
        throw error;
    }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background received message:', request);

    if (request.action === 'createVersion') {
        (async () => {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tab) throw new Error('No active tab found');

                // Ensure content script is injected
                const injected = await injectContentScript(tab.id);
                if (!injected) throw new Error('Failed to inject content script');

                // Forward message to content script
                const response = await chrome.tabs.sendMessage(tab.id, request);
                sendResponse(response);
            } catch (error) {
                console.error('Error in createVersion:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }
});

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url?.includes('.atlassian.net')) {
        console.log('Tab updated:', tabId);
        injectContentScript(tabId);
    }
});

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
    console.log('Tab removed:', tabId);
    loadedTabs.delete(tabId);
});
