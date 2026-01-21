/**
 * FLYCON License Activation UI
 * Handles license validation, activation, and reactivation flows
 */

class LicenseUI {
  constructor() {
    this.isLicensed = false;
    this.licenseStatus = null;
    this.modal = null;
  }

  /**
   * Initialize license check on app start
   */
  async init() {
    // Check license status
    const result = await window.sccmAPI.license.validate();

    if (result.valid) {
      this.isLicensed = true;
      this.licenseStatus = result.license;
      console.log('License valid:', result.license);
      return true;
    } else {
      this.isLicensed = false;
      console.log('License invalid:', result.error);

      // Show activation modal
      if (result.requiresReactivation) {
        this.showReactivationModal();
      } else {
        this.showActivationModal();
      }
      return false;
    }
  }

  /**
   * Create and show the activation modal
   */
  showActivationModal() {
    // Remove existing modal if any
    this.removeModal();

    this.modal = document.createElement('div');
    this.modal.className = 'license-modal-overlay';
    this.modal.innerHTML = `
      <div class="license-modal">
        <div class="license-modal-header">
          <h2>Activate FLYCON</h2>
        </div>
        <div class="license-modal-body">
          <p>Please enter your license key to activate FLYCON.</p>
          <p class="license-hint">License keys are sent to your email after purchase.</p>

          <div class="license-input-group">
            <label for="license-key-input">License Key</label>
            <input
              type="text"
              id="license-key-input"
              placeholder="FLYCON-XXXX-XXXX-XXXX-XXXX"
              maxlength="26"
              autocomplete="off"
              spellcheck="false"
            />
          </div>

          <div class="license-error" id="license-error" style="display: none;"></div>

          <div class="license-actions">
            <button class="license-btn license-btn-primary" id="license-activate-btn">
              Activate License
            </button>
          </div>

          <div class="license-footer">
            <p>Don't have a license? <a href="https://flycon.app/buy" target="_blank">Purchase FLYCON ($14.99)</a></p>
            <p><a href="#" id="license-reactivate-link">Need to reactivate on new hardware?</a></p>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.modal);

    // Auto-format license key input
    const input = document.getElementById('license-key-input');
    input.addEventListener('input', (e) => this.formatLicenseKey(e));
    input.addEventListener('paste', (e) => {
      setTimeout(() => this.formatLicenseKey({ target: input }), 10);
    });

    // Activate button handler
    document.getElementById('license-activate-btn').addEventListener('click', () => {
      this.activateLicense();
    });

    // Enter key to submit
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.activateLicense();
      }
    });

    // Reactivation link
    document.getElementById('license-reactivate-link').addEventListener('click', (e) => {
      e.preventDefault();
      this.showReactivationModal();
    });

    // Focus input
    setTimeout(() => input.focus(), 100);
  }

  /**
   * Show reactivation modal for hardware changes
   */
  showReactivationModal() {
    this.removeModal();

    this.modal = document.createElement('div');
    this.modal.className = 'license-modal-overlay';
    this.modal.innerHTML = `
      <div class="license-modal">
        <div class="license-modal-header">
          <h2>Reactivate FLYCON</h2>
        </div>
        <div class="license-modal-body">
          <p>Your license is registered to different hardware. To use FLYCON on this computer, please reactivate.</p>
          <p class="license-hint">You have a limited number of reactivations. Contact support if you need more.</p>

          <div class="license-input-group">
            <label for="license-key-input">License Key</label>
            <input
              type="text"
              id="license-key-input"
              placeholder="FLYCON-XXXX-XXXX-XXXX-XXXX"
              maxlength="26"
              autocomplete="off"
              spellcheck="false"
            />
          </div>

          <div class="license-input-group">
            <label for="license-email-input">Email Address</label>
            <input
              type="email"
              id="license-email-input"
              placeholder="your@email.com"
              autocomplete="email"
            />
          </div>

          <div class="license-error" id="license-error" style="display: none;"></div>

          <div class="license-actions">
            <button class="license-btn license-btn-primary" id="license-reactivate-btn">
              Reactivate License
            </button>
            <button class="license-btn license-btn-secondary" id="license-back-btn">
              Back
            </button>
          </div>

          <div class="license-footer">
            <p>Need help? <a href="mailto:support@flycon.app">Contact Support</a></p>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.modal);

    // Auto-format license key
    const keyInput = document.getElementById('license-key-input');
    keyInput.addEventListener('input', (e) => this.formatLicenseKey(e));

    // Reactivate button
    document.getElementById('license-reactivate-btn').addEventListener('click', () => {
      this.reactivateLicense();
    });

    // Back button
    document.getElementById('license-back-btn').addEventListener('click', () => {
      this.showActivationModal();
    });

    setTimeout(() => keyInput.focus(), 100);
  }

  /**
   * Format license key as user types (add dashes)
   */
  formatLicenseKey(e) {
    let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');

    // Add FLYCON- prefix if not present
    if (value.length > 0 && !value.startsWith('FLYCON')) {
      if (value.length <= 16) {
        // Format as XXXX-XXXX-XXXX-XXXX
        const parts = value.match(/.{1,4}/g) || [];
        value = 'FLYCON-' + parts.join('-');
      }
    } else if (value.startsWith('FLYCON')) {
      // Already has prefix, format the rest
      const rest = value.substring(6);
      const parts = rest.match(/.{1,4}/g) || [];
      value = 'FLYCON-' + parts.join('-');
    }

    e.target.value = value;
  }

  /**
   * Activate license with entered key
   */
  async activateLicense() {
    const keyInput = document.getElementById('license-key-input');
    const errorDiv = document.getElementById('license-error');
    const btn = document.getElementById('license-activate-btn');

    const licenseKey = keyInput.value.trim();

    if (!licenseKey || licenseKey.length < 20) {
      this.showError('Please enter a valid license key');
      return;
    }

    // Show loading state
    btn.disabled = true;
    btn.textContent = 'Activating...';
    errorDiv.style.display = 'none';

    try {
      const result = await window.sccmAPI.license.activate(licenseKey);

      if (result.success) {
        this.isLicensed = true;
        this.licenseStatus = result.license;
        this.showSuccess('License activated successfully!');

        // Close modal after delay
        setTimeout(() => {
          this.removeModal();
          // Reload app or enable features
          window.location.reload();
        }, 1500);
      } else {
        if (result.requiresReactivation) {
          this.showError('This license is activated on different hardware. Click "Need to reactivate?" below.');
        } else {
          this.showError(result.error || 'Activation failed. Please check your license key.');
        }
        btn.disabled = false;
        btn.textContent = 'Activate License';
      }
    } catch (error) {
      this.showError('Connection error. Please check your internet and try again.');
      btn.disabled = false;
      btn.textContent = 'Activate License';
    }
  }

  /**
   * Reactivate license on new hardware
   */
  async reactivateLicense() {
    const keyInput = document.getElementById('license-key-input');
    const emailInput = document.getElementById('license-email-input');
    const errorDiv = document.getElementById('license-error');
    const btn = document.getElementById('license-reactivate-btn');

    const licenseKey = keyInput.value.trim();
    const email = emailInput.value.trim();

    if (!licenseKey || licenseKey.length < 20) {
      this.showError('Please enter a valid license key');
      return;
    }

    if (!email || !email.includes('@')) {
      this.showError('Please enter a valid email address');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Reactivating...';
    errorDiv.style.display = 'none';

    try {
      const result = await window.sccmAPI.license.reactivate(licenseKey, email);

      if (result.success) {
        this.isLicensed = true;
        this.licenseStatus = result.license;

        let message = 'License reactivated successfully!';
        if (result.reactivationsRemaining !== undefined) {
          message += ` (${result.reactivationsRemaining} reactivations remaining)`;
        }
        this.showSuccess(message);

        setTimeout(() => {
          this.removeModal();
          window.location.reload();
        }, 2000);
      } else {
        this.showError(result.error || 'Reactivation failed.');
        btn.disabled = false;
        btn.textContent = 'Reactivate License';
      }
    } catch (error) {
      this.showError('Connection error. Please check your internet and try again.');
      btn.disabled = false;
      btn.textContent = 'Reactivate License';
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    const errorDiv = document.getElementById('license-error');
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
      errorDiv.className = 'license-error license-error-show';
    }
  }

  /**
   * Show success message
   */
  showSuccess(message) {
    const errorDiv = document.getElementById('license-error');
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
      errorDiv.className = 'license-error license-success-show';
    }
  }

  /**
   * Remove modal from DOM
   */
  removeModal() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
    // Also remove any existing modals
    document.querySelectorAll('.license-modal-overlay').forEach(el => el.remove());
  }

  /**
   * Check if app is licensed
   */
  checkLicense() {
    return this.isLicensed;
  }
}

// Export singleton instance
window.licenseUI = new LicenseUI();
