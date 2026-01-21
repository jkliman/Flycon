const { app } = require('electron');
const { execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const https = require('https');

// License API endpoint - UPDATE THIS after deploying Cloud Functions
const LICENSE_API_URL = process.env.LICENSE_API_URL || 'https://us-central1-solar-modem-484815-m0.cloudfunctions.net/flycon-license-api';

// License file location
const LICENSE_FILE = path.join(app.getPath('userData'), 'license.json');

class LicenseManager {
  constructor() {
    this.license = null;
    this.hardwareId = null;
  }

  /**
   * Get hardware IDs (CPU and Motherboard)
   * Uses Windows WMI commands
   */
  getHardwareIds() {
    if (this.hardwareId) return this.hardwareId;

    try {
      let cpuId = '';
      let motherboardId = '';

      if (process.platform === 'win32') {
        // Get CPU ID
        try {
          const cpuResult = execSync(
            'wmic cpu get ProcessorId /format:value',
            { encoding: 'utf8', windowsHide: true }
          );
          const cpuMatch = cpuResult.match(/ProcessorId=(\w+)/);
          cpuId = cpuMatch ? cpuMatch[1] : '';
        } catch (e) {
          console.error('Failed to get CPU ID:', e.message);
        }

        // Get Motherboard Serial
        try {
          const mbResult = execSync(
            'wmic baseboard get SerialNumber /format:value',
            { encoding: 'utf8', windowsHide: true }
          );
          const mbMatch = mbResult.match(/SerialNumber=(.+)/);
          motherboardId = mbMatch ? mbMatch[1].trim() : '';
        } catch (e) {
          // Fallback to motherboard product
          try {
            const mbResult = execSync(
              'wmic baseboard get Product /format:value',
              { encoding: 'utf8', windowsHide: true }
            );
            const mbMatch = mbResult.match(/Product=(.+)/);
            motherboardId = mbMatch ? mbMatch[1].trim() : '';
          } catch (e2) {
            console.error('Failed to get Motherboard ID:', e2.message);
          }
        }
      } else if (process.platform === 'darwin') {
        // macOS - use system_profiler
        try {
          const result = execSync(
            'system_profiler SPHardwareDataType | grep "Serial Number"',
            { encoding: 'utf8' }
          );
          const match = result.match(/Serial Number.*: (.+)/);
          cpuId = match ? match[1].trim() : '';
          motherboardId = cpuId; // macOS uses serial for both
        } catch (e) {
          console.error('Failed to get macOS hardware ID:', e.message);
        }
      } else {
        // Linux - use /etc/machine-id or dmidecode
        try {
          cpuId = fs.readFileSync('/etc/machine-id', 'utf8').trim();
          motherboardId = cpuId;
        } catch (e) {
          console.error('Failed to get Linux hardware ID:', e.message);
        }
      }

      // Fallback if we couldn't get hardware IDs
      if (!cpuId && !motherboardId) {
        // Use a combination of hostname and username as fallback
        const os = require('os');
        cpuId = os.hostname();
        motherboardId = os.userInfo().username;
      }

      this.hardwareId = { cpuId, motherboardId };
      return this.hardwareId;

    } catch (error) {
      console.error('Error getting hardware IDs:', error);
      throw new Error('Failed to retrieve hardware identification');
    }
  }

  /**
   * Make HTTP request to license API
   */
  async apiRequest(endpoint, method, data) {
    return new Promise((resolve, reject) => {
      // Build full URL by appending endpoint to base URL
      const fullUrl = LICENSE_API_URL + endpoint;
      const url = new URL(fullUrl);
      const postData = data ? JSON.stringify(data) : null;

      const options = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          ...(postData && { 'Content-Length': Buffer.byteLength(postData) })
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(body);
            resolve({ status: res.statusCode, data: response });
          } catch (e) {
            reject(new Error('Invalid response from license server'));
          }
        });
      });

      req.on('error', (e) => {
        reject(new Error(`License server connection failed: ${e.message}`));
      });

      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('License server timeout'));
      });

      if (postData) req.write(postData);
      req.end();
    });
  }

  /**
   * Load saved license from disk
   */
  loadSavedLicense() {
    try {
      if (fs.existsSync(LICENSE_FILE)) {
        const data = fs.readFileSync(LICENSE_FILE, 'utf8');
        this.license = JSON.parse(data);
        return this.license;
      }
    } catch (error) {
      console.error('Error loading saved license:', error);
    }
    return null;
  }

  /**
   * Save license to disk
   */
  saveLicense(license) {
    try {
      fs.writeFileSync(LICENSE_FILE, JSON.stringify(license, null, 2));
      this.license = license;
    } catch (error) {
      console.error('Error saving license:', error);
      throw new Error('Failed to save license');
    }
  }

  /**
   * Clear saved license
   */
  clearLicense() {
    try {
      if (fs.existsSync(LICENSE_FILE)) {
        fs.unlinkSync(LICENSE_FILE);
      }
      this.license = null;
    } catch (error) {
      console.error('Error clearing license:', error);
    }
  }

  /**
   * Validate current license
   * Returns: { valid: boolean, error?: string, requiresActivation?: boolean }
   */
  async validateLicense() {
    const savedLicense = this.loadSavedLicense();

    if (!savedLicense || !savedLicense.key) {
      return { valid: false, requiresActivation: true, error: 'No license found' };
    }

    try {
      const { cpuId, motherboardId } = this.getHardwareIds();

      const { status, data } = await this.apiRequest('/validate', 'POST', {
        licenseKey: savedLicense.key,
        cpuId,
        motherboardId
      });

      if (data.valid) {
        return { valid: true, license: data.license };
      } else {
        return {
          valid: false,
          error: data.error,
          requiresActivation: data.requiresActivation,
          requiresReactivation: data.requiresReactivation
        };
      }

    } catch (error) {
      // Allow offline mode if we have a saved valid license
      if (savedLicense.activated && savedLicense.status === 'active') {
        console.log('Offline mode - using cached license');
        return { valid: true, license: savedLicense, offline: true };
      }
      return { valid: false, error: error.message };
    }
  }

  /**
   * Activate a new license key
   */
  async activateLicense(licenseKey) {
    try {
      const { cpuId, motherboardId } = this.getHardwareIds();

      const { status, data } = await this.apiRequest('/activate', 'POST', {
        licenseKey: licenseKey.toUpperCase().trim(),
        cpuId,
        motherboardId
      });

      if (data.success) {
        // Save license locally
        this.saveLicense({
          key: licenseKey.toUpperCase().trim(),
          ...data.license,
          activated: true,
          status: 'active'
        });

        return { success: true, license: data.license };
      } else {
        return {
          success: false,
          error: data.error,
          requiresReactivation: data.requiresReactivation
        };
      }

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Reactivate license on new hardware
   */
  async reactivateLicense(licenseKey, email) {
    try {
      const { cpuId, motherboardId } = this.getHardwareIds();

      const { status, data } = await this.apiRequest('/reactivate', 'POST', {
        licenseKey: licenseKey.toUpperCase().trim(),
        cpuId,
        motherboardId,
        email
      });

      if (data.success) {
        // Save license locally
        this.saveLicense({
          key: licenseKey.toUpperCase().trim(),
          ...data.license,
          activated: true,
          status: 'active'
        });

        return {
          success: true,
          license: data.license,
          reactivationsRemaining: data.reactivationsRemaining
        };
      } else {
        return { success: false, error: data.error };
      }

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get current license status
   */
  getLicenseStatus() {
    const license = this.loadSavedLicense();
    if (!license) {
      return { status: 'unlicensed' };
    }
    return {
      status: license.status || 'unknown',
      key: license.key,
      email: license.email,
      activationDate: license.activationDate
    };
  }
}

module.exports = new LicenseManager();
