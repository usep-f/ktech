/**
 * KTech Solutions - Toast & Modal Notification System
 * This module replaces native alert(), confirm(), and prompt() with custom, styled components.
 */

// Initialize the toast container
function getToastContainer() {
    let container = document.getElementById('ktech-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'ktech-toast-container';
        container.className = 'fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none';
        document.body.appendChild(container);
    }
    return container;
}

/**
 * Show a toast notification
 * @param {string} message - The message to display
 * @param {string} type - 'success', 'error', 'info', or 'warning'
 */
export function showToast(message, type = 'info') {
    const container = getToastContainer();
    
    const toast = document.createElement('div');
    toast.className = 'pointer-events-auto transform translate-x-full opacity-0 transition-all duration-300 flex items-center gap-3 px-4 py-3 rounded-lg shadow-2xl min-w-[300px] max-w-md';
    
    let icon = '';
    let bgClass = '';
    let iconClass = '';
    
    switch (type) {
        case 'success':
            icon = 'check_circle';
            bgClass = 'bg-[#191f31] border border-[#00e5ff]/30 text-[#dce1fb]'; // surface-container with primary border
            iconClass = 'text-[#00e5ff]'; // primary
            break;
        case 'error':
            icon = 'error';
            bgClass = 'bg-[#191f31] border border-[#ffb4ab]/30 text-[#dce1fb]'; // error
            iconClass = 'text-[#ffb4ab]';
            break;
        case 'warning':
            icon = 'warning';
            bgClass = 'bg-[#191f31] border border-[#c3d1ea]/30 text-[#dce1fb]';
            iconClass = 'text-[#c3d1ea]';
            break;
        case 'info':
        default:
            icon = 'info';
            bgClass = 'bg-[#191f31] border border-[#3b494c] text-[#dce1fb]';
            iconClass = 'text-[#00daf3]';
            break;
    }
    
    toast.className += ` ${bgClass}`;
    toast.innerHTML = `
        <span class="material-symbols-outlined ${iconClass}">${icon}</span>
        <p class="font-body-sm text-sm flex-grow">${message}</p>
        <button class="text-[#849396] hover:text-[#dce1fb] transition-colors ml-2">
            <span class="material-symbols-outlined text-[18px]">close</span>
        </button>
    `;
    
    const closeBtn = toast.querySelector('button');
    
    container.appendChild(toast);
    
    // Animate in
    requestAnimationFrame(() => {
        toast.classList.remove('translate-x-full', 'opacity-0');
    });
    
    // Setup auto-dismiss
    let timeout;
    const dismiss = () => {
        toast.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => {
            if (toast.parentElement) toast.parentElement.removeChild(toast);
        }, 300);
    };
    
    timeout = setTimeout(dismiss, 5000);
    
    closeBtn.addEventListener('click', () => {
        clearTimeout(timeout);
        dismiss();
    });
}

/**
 * Show a confirmation modal (Replaces confirm())
 * @param {string} message - The message to confirm
 * @returns {Promise<boolean>} Resolves to true if confirmed, false if cancelled
 */
export function showConfirm(message) {
    return new Promise((resolve) => {
        createModal({
            title: 'Confirm Action',
            message: message,
            icon: 'help',
            iconColor: 'text-[#00e5ff]',
            confirmText: 'Confirm',
            cancelText: 'Cancel',
            confirmClass: 'bg-[#00e5ff] text-[#001f24] hover:bg-[#9cf0ff]',
            onConfirm: () => resolve(true),
            onCancel: () => resolve(false)
        });
    });
}

/**
 * Show a prompt modal (Replaces prompt())
 * @param {string} message - The message asking for input
 * @param {string} inputType - 'text', 'password', etc.
 * @returns {Promise<string|null>} Resolves to input value or null if cancelled
 */
export function showPrompt(message, inputType = 'text') {
    return new Promise((resolve) => {
        createModal({
            title: 'Input Required',
            message: message,
            icon: 'edit',
            iconColor: 'text-[#00daf3]',
            isPrompt: true,
            inputType: inputType,
            confirmText: 'Submit',
            cancelText: 'Cancel',
            confirmClass: 'bg-[#00e5ff] text-[#001f24] hover:bg-[#9cf0ff]',
            onConfirm: (val) => resolve(val),
            onCancel: () => resolve(null)
        });
    });
}

// Internal generic modal builder
function createModal({ title, message, icon, iconColor, isPrompt, inputType, confirmText, cancelText, confirmClass, onConfirm, onCancel }) {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-[#070d1f]/80 backdrop-blur-sm opacity-0 transition-opacity duration-300';
    
    const card = document.createElement('div');
    card.className = 'bg-[#151b2d] border border-[#3b494c] rounded-xl shadow-2xl p-6 w-full max-w-md transform scale-95 transition-transform duration-300';
    
    card.innerHTML = `
        <div class="flex items-center gap-3 mb-4">
            <span class="material-symbols-outlined text-3xl ${iconColor}">${icon}</span>
            <h3 class="text-xl font-bold text-[#dce1fb] font-headline-sm">${title}</h3>
        </div>
        <p class="text-[#bac9cc] text-sm mb-6 font-body-sm">${message}</p>
        ${isPrompt ? `<input type="${inputType}" id="ktech-prompt-input" class="w-full bg-[#0c1324] border border-[#3b494c] rounded-lg p-3 text-[#dce1fb] mb-6 focus:border-[#00e5ff] focus:outline-none focus:ring-1 focus:ring-[#00e5ff] font-body-md" autofocus>` : ''}
        <div class="flex justify-end gap-3">
            <button id="ktech-modal-cancel" class="px-5 py-2 rounded-lg font-medium text-[#bac9cc] hover:bg-[#2e3447] transition-colors font-label-md">${cancelText}</button>
            <button id="ktech-modal-confirm" class="px-5 py-2 rounded-lg font-medium transition-colors font-label-md shadow-lg ${confirmClass}">${confirmText}</button>
        </div>
    `;
    
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    
    const input = card.querySelector('#ktech-prompt-input');
    const btnCancel = card.querySelector('#ktech-modal-cancel');
    const btnConfirm = card.querySelector('#ktech-modal-confirm');
    
    // Animate in
    requestAnimationFrame(() => {
        overlay.classList.remove('opacity-0');
        card.classList.remove('scale-95');
    });
    
    const close = () => {
        overlay.classList.add('opacity-0');
        card.classList.add('scale-95');
        setTimeout(() => {
            if (overlay.parentElement) document.body.removeChild(overlay);
        }, 300);
    };
    
    const handleConfirm = () => {
        close();
        onConfirm(isPrompt ? input.value : true);
    };
    
    const handleCancel = () => {
        close();
        onCancel();
    };
    
    btnCancel.addEventListener('click', handleCancel);
    btnConfirm.addEventListener('click', handleConfirm);
    
    if (isPrompt && input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleConfirm();
        });
        setTimeout(() => input.focus(), 100);
    }
}
