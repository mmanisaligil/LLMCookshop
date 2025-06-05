// LLM Cookshop Script v0.3
// By Apex Commander Olidros & V.I.V.I.E.N.N.E.

document.addEventListener('DOMContentLoaded', () => {
    // ========== GLOBAL STATE & CONFIG ========== //
    let uploadedMarkdowns = [];
    let presetPrompts = [];
    let selectedCorePromptIndex = null;
    let selectedAddonIndices = [];

    const llmConfigs = [
        { name: 'Gemini 1.5 Flash', id: 'gemini-1.5-flash-latest', defaultTemperature: 0.4, defaultMaxTokens: 8192, endpoint: 'gemini-1.5-flash-latest' },
        { name: 'Gemini 1.5 Pro', id: 'gemini-1.5-pro-latest', defaultTemperature: 0.5, defaultMaxTokens: 8192, endpoint: 'gemini-1.5-pro-latest' },
        { name: 'Gemini Pro (Legacy)', id: 'gemini-pro', defaultTemperature: 0.7, defaultMaxTokens: 2048, endpoint: 'gemini-pro' }
    ];
    let activeLLMConfig = { ...llmConfigs[0] }; // Initialize with the first model

    // ========== DOM ELEMENTS ========== //
    const markdownUploadInput = document.getElementById('markdown-upload');
    const fileListDisplay = document.getElementById('file-list');
    const llmConfigSelect = document.getElementById('llm-config-select');
    const tempSlider = document.getElementById('temperature-slider');
    const tempValueDisplay = document.getElementById('temperature-value');
    const tokensSlider = document.getElementById('max-tokens-slider');
    const tokensValueDisplay = document.getElementById('max-tokens-value');
    const corePromptListDiv = document.getElementById('core-prompt-list');
    const addonPromptListDiv = document.getElementById('addon-prompt-list');
    const customPromptTextarea = document.getElementById('custom-prompt');
    const runLLMButton = document.getElementById('run-llm');
    const clearPromptButton = document.getElementById('clear-prompt');
    const llmOutputTextarea = document.getElementById('llm-output');
    const downloadMDButton = document.getElementById('download-md');
    const copyOutputButton = document.getElementById('copy-output');
    const outputTipDiv = document.getElementById('output-tip');

    // Modal elements
    const showHelpButton = document.getElementById('show-help');
    const modalHelp = document.getElementById('modal-help');
    const closeHelpButton = document.getElementById('close-help');
    const showAboutButton = document.getElementById('show-about');
    const modalAbout = document.getElementById('modal-about');
    const closeAboutButton = document.getElementById('close-about');

    // ========== INITIALIZATION ========== //

    function initializeLLMConfigs() {
        llmConfigs.forEach(cfg => {
            llmConfigSelect.innerHTML += `<option value="${cfg.id}">${cfg.name}</option>`;
        });
        updateLLMParamUI(activeLLMConfig); // Set initial slider values
        // Initialize sliders max based on current model. Max value might need to be set dynamically or use a common large value
        // For Gemini 1.5 models, max tokens can be very high (e.g. 1M or more for context window)
        // But generation `maxOutputTokens` is usually less. Here we set slider max to 8192 or higher based on model
        tokensSlider.max = activeLLMConfig.defaultMaxTokens > 4096 ? activeLLMConfig.defaultMaxTokens : 4096; 
    }

    function updateLLMParamUI(config) {
        tempSlider.value = config.defaultTemperature;
        tempValueDisplay.textContent = config.defaultTemperature;
        tokensSlider.max = config.id.includes("1.5") ? 8192 : 4096; // Adjust max based on model family for output
        tokensSlider.value = Math.min(config.defaultMaxTokens, tokensSlider.max); // Ensure default isn't over max
        tokensValueDisplay.textContent = tokensSlider.value;
        
        activeLLMConfig.currentTemperature = parseFloat(tempSlider.value);
        activeLLMConfig.currentMaxTokens = parseInt(tokensSlider.value);
    }

    async function fetchPresetPrompts() {
        try {
            // This fetches 'preset-01.json' from the `public` directory,
            // relative to where index.html is served.
            const response = await fetch('preset-01.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            presetPrompts = await response.json();
            renderPromptGalleria();
        } catch (error) {
            console.error("Failed to load presets from 'preset-01.json':", error);
            corePromptListDiv.innerHTML = "<p class='error-text'>Error loading prompts. Check console.</p>";
        }
    }

    // ========== EVENT LISTENERS ========== //

    markdownUploadInput.addEventListener('change', (event) => {
        uploadedMarkdowns = [];
        const files = event.target.files;
        const fileNames = [];
        fileListDisplay.innerHTML = ''; // Clear previous list

        Array.from(files).forEach(file => {
            if (file.type === "text/markdown" || file.name.endsWith('.md')) {
                fileNames.push(file.name);
                const reader = new FileReader();
                reader.onload = (e) => {
                    uploadedMarkdowns.push({ name: file.name, content: e.target.result });
                };
                reader.readAsText(file);
            } else {
                console.warn(`Skipping non-markdown file: ${file.name}`);
            }
        });
        fileListDisplay.innerHTML = fileNames.map(fn => `<li>${fn}</li>`).join('');
        if (fileNames.length > 0) {
             document.getElementById('upload-section').classList.add('active');
        } else {
             document.getElementById('upload-section').classList.remove('active');
        }
    });

    llmConfigSelect.addEventListener('change', () => {
        const selectedId = llmConfigSelect.value;
        const newConfig = llmConfigs.find(cfg => cfg.id === selectedId);
        if (newConfig) {
            activeLLMConfig = { ...newConfig }; 
            updateLLMParamUI(activeLLMConfig);
        }
    });

    tempSlider.addEventListener('input', () => {
        tempValueDisplay.textContent = tempSlider.value;
        activeLLMConfig.currentTemperature = parseFloat(tempSlider.value);
    });

    tokensSlider.addEventListener('input', () => {
        tokensValueDisplay.textContent = tokensSlider.value;
        activeLLMConfig.currentMaxTokens = parseInt(tokensSlider.value);
    });

    runLLMButton.addEventListener('click', handleRunLLM);
    clearPromptButton.addEventListener('click', handleClear);
    downloadMDButton.addEventListener('click', handleDownloadOutput);
    copyOutputButton.addEventListener('click', handleCopyOutput);

    // Modal listeners
    showHelpButton.addEventListener('click', (e) => { e.preventDefault(); modalHelp.style.display = 'flex'; });
    closeHelpButton.addEventListener('click', () => modalHelp.style.display = 'none');
    showAboutButton.addEventListener('click', (e) => { e.preventDefault(); modalAbout.style.display = 'flex'; });
    closeAboutButton.addEventListener('click', () => modalAbout.style.display = 'none');
    window.addEventListener('click', (event) => { 
        if (event.target == modalHelp) modalHelp.style.display = 'none';
        if (event.target == modalAbout) modalAbout.style.display = 'none';
    });

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            runLLMButton.click();
        }
        if (e.key === 'Escape') {
            if (modalHelp.style.display === 'flex') modalHelp.style.display = 'none';
            else if (modalAbout.style.display === 'flex') modalAbout.style.display = 'none';
            else clearPromptButton.click();
        }
    });

    // ========== PROMPT GALLERIA LOGIC ========== //

    function renderPromptGalleria() {
        corePromptListDiv.innerHTML = '';
        addonPromptListDiv.innerHTML = '';

        presetPrompts.forEach((prompt, idx) => {
            // Assuming all prompts in 'preset-01.json' are 'core' for simplicity here
            // Your v0.3 prompt file `preset-00-flight-check.json` implies these are all independent choices.
            // Adjust logic if you intend to distinguish core/addon in `'preset-01.json'` via a 'type' field.
            const promptType = prompt.type || 'core'; // Default to 'core'

            const label = document.createElement('label');
            label.title = prompt.prompt_text;
            const input = document.createElement('input');
            input.value = idx;

            if (promptType === 'core') {
                input.type = 'radio';
                input.name = 'core-prompt';
                input.addEventListener('change', (e) => {
                    selectedCorePromptIndex = parseInt(e.target.value);
                    document.getElementById('prompt-section').classList.add('active');
                });
                label.appendChild(input);
                label.appendChild(document.createTextNode(` ${prompt.prompt_name}`));
                corePromptListDiv.appendChild(label);
            } else { // 'addon' - Currently your 'preset-01.json' doesn't seem to have addons
                input.type = 'checkbox';
                input.addEventListener('change', (e) => {
                    const index = parseInt(e.target.value);
                    if (e.target.checked) {
                        if (!selectedAddonIndices.includes(index)) selectedAddonIndices.push(index);
                    } else {
                        selectedAddonIndices = selectedAddonIndices.filter(i => i !== index);
                    }
                    document.getElementById('prompt-section').classList.add('active');
                });
                label.appendChild(input);
                label.appendChild(document.createTextNode(` ${prompt.prompt_name}`));
                addonPromptListDiv.appendChild(label);
            }
        });
    }

    function assembleFinalPrompt() {
        let promptParts = [];
        // If a core prompt is selected, its text forms the base
        if (selectedCorePromptIndex !== null && presetPrompts[selectedCorePromptIndex]) {
            promptParts.push(presetPrompts[selectedCorePromptIndex].prompt_text);
        }
        // Addon prompts are appended
        selectedAddonIndices.forEach(idx => {
            if (presetPrompts[idx]) promptParts.push(presetPrompts[idx].prompt_text);
        });
        const customText = customPromptTextarea.value.trim();
        if (customText) {
            promptParts.push(customText);
        }

        // Join system/instructional prompts
        let systemPromptSection = promptParts.join('\n\n');
        
        // Add uploaded markdown content, clearly demarcated
        if (uploadedMarkdowns.length > 0) {
            const mergedMarkdownContent = uploadedMarkdowns
                .map(md => `--- FILE START: ${md.name} ---\n\n${md.content}\n\n--- FILE END: ${md.name} ---`)
                .join('\n\n');
            
            // Combine system prompt with markdown content
            // Ensure markdown content is clearly presented *after* all instructions
            if (systemPromptSection) {
                systemPromptSection += `\n\n--- USER CONTENT TO PROCESS BELOW ---\n\n${mergedMarkdownContent}`;
            } else { // If no prompts selected/written, just process the markdown.
                systemPromptSection = mergedMarkdownContent;
            }
        }
        return systemPromptSection;
    }

    // ========== CORE ACTIONS ========== //

    async function handleRunLLM() {
        const finalCombinedPrompt = assembleFinalPrompt();

        if (!finalCombinedPrompt && uploadedMarkdowns.length === 0) {
             alert('Please upload Markdown, select a prompt, or write a custom directive.');
             return;
        }
        if (uploadedMarkdowns.length === 0 && !finalCombinedPrompt.trim()) {
             alert('No content to process. Please upload a Markdown file or provide a prompt.');
             return;
        }


        llmOutputTextarea.value = "Cooking with AI... please wait...";
        runLLMButton.disabled = true;
        runLLMButton.textContent = "Cooking... 🍳"; // More visual feedback
        runLLMButton.classList.add('cooking'); // For potential CSS animations

        try {
            const response = await fetch('/api/llm-cookshop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    llmModelId: activeLLMConfig.id,
                    temperature: activeLLMConfig.currentTemperature,
                    maxTokens: activeLLMConfig.currentMaxTokens,
                    prompt: finalCombinedPrompt // This now includes markdown if present
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: `API request failed with status ${response.status}` }));
                throw new Error(errorData.error || `API request failed with status ${response.status}`);
            }

            const data = await response.json();
            llmOutputTextarea.value = data.output;
            downloadMDButton.style.display = 'inline-block';
            document.getElementById('output-section').classList.add('active');
            outputTipDiv.textContent = "Output received!";

        } catch (error) {
            console.error("LLM API Error:", error);
            llmOutputTextarea.value = `Error: ${error.message}`;
            outputTipDiv.textContent = "An error occurred.";
        } finally {
            runLLMButton.disabled = false;
            runLLMButton.textContent = "Cook 🍳";
            runLLMButton.classList.remove('cooking');
            setTimeout(() => outputTipDiv.textContent = '', 3000);
        }
    }

    function handleClear() {
        customPromptTextarea.value = '';
        llmOutputTextarea.value = '';
        document.querySelectorAll('#core-prompt-list input[type=radio]').forEach(el => el.checked = false);
        document.querySelectorAll('#addon-prompt-list input[type=checkbox]').forEach(el => el.checked = false);
        selectedCorePromptIndex = null;
        selectedAddonIndices = [];
        downloadMDButton.style.display = 'none';
        
        // Clear file uploads
        uploadedMarkdowns = [];
        fileListDisplay.innerHTML = '';
        markdownUploadInput.value = null; // Resets the file input

        ['upload-section', 'prompt-section', 'output-section'].forEach(id => {
            const panel = document.getElementById(id);
            if(panel) panel.classList.remove('active');
        });
        outputTipDiv.textContent = 'Cleared!';
        setTimeout(() => outputTipDiv.textContent = '', 1200);
    }

    function handleDownloadOutput() {
        if (!llmOutputTextarea.value) return;
        const blob = new Blob([llmOutputTextarea.value], { type: 'text/markdown;charset=utf-8' });
        const a = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        a.href = URL.createObjectURL(blob);
        a.download = `llm-cookshop-output-${timestamp}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
        outputTipDiv.textContent = 'Downloaded!';
        setTimeout(() => outputTipDiv.textContent = '', 1200);
    }

    function handleCopyOutput() {
        if (!llmOutputTextarea.value) return;
        navigator.clipboard.writeText(llmOutputTextarea.value).then(() => {
            outputTipDiv.textContent = 'Copied to clipboard!';
            setTimeout(() => outputTipDiv.textContent = '', 1200);
        }).catch(err => {
            console.error('Failed to copy: ', err);
            outputTipDiv.textContent = 'Copy failed! (Check console/permissions)';
            setTimeout(() => outputTipDiv.textContent = '', 2000);
        });
    }

    // ========== STARTUP ========== //
    initializeLLMConfigs();
    fetchPresetPrompts();

    document.querySelectorAll('.bento-panel input, .bento-panel select, .bento-panel textarea').forEach(el => {
        el.addEventListener('focus', (e) => {
            const panel = e.target.closest('.bento-panel');
            if (panel) panel.classList.add('active');
        });
        el.addEventListener('blur', (e) => {
            // Only remove active if no other focusable element within the same panel has focus
            // This handles tabbing between elements in the same panel
            setTimeout(() => { // Timeout to allow next focus event to fire
                const panel = e.target.closest('.bento-panel');
                if (panel && !panel.contains(document.activeElement)) {
                    panel.classList.remove('active');
                }
            }, 0);
        });
    });
});