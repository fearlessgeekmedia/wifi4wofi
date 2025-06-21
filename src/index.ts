#!/usr/bin/env bun
// OR #!/usr/bin/env node (if you're using Node.js instead of Bun)

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const execAsync = promisify(exec);

interface Config {
    FIELDS?: string;
    POSITION?: number;
    YOFF?: number;
    XOFF?: number;
    [key: string]: string | number | undefined;
}

class Wifi4Wofi {
    private config: Config = {
        FIELDS: 'SSID,SECURITY',
        POSITION: 0,
        YOFF: 0,
        XOFF: 0
    };
    private WIFI_IFACE: string | null = null; // Declare WIFI_IFACE as a class property

    constructor() {
        this.loadConfig();
    }

    private loadConfig(): void {
        const configPaths = [
            join(process.cwd(), 'config'),
            join(homedir(), '.config', 'wofi', 'wifi')
        ];

        console.log('Looking for config in:', configPaths);

        for (const path of configPaths) {
            try {
                console.log('Trying to read config from:', path);
                const configContent = readFileSync(path, 'utf-8');
                const configLines = configContent.split('\n');

                for (const line of configLines) {
                    if (line.trim().startsWith('#')) continue;
                    const [key, value] = line.split('=');
                    if (key && value) {
                        const trimmedKey = key.trim();
                        const trimmedValue = value.trim();
                        if (['POSITION', 'XOFF', 'YOFF'].includes(trimmedKey)) {
                            this.config[trimmedKey] = parseInt(trimmedValue, 10);
                            console.log(`Set ${trimmedKey} to ${this.config[trimmedKey]} (numeric)`);
                        } else {
                            this.config[trimmedKey] = trimmedValue;
                            console.log(`Set ${trimmedKey} to ${this.config[trimmedKey]} (string)`);
                        }
                    }
                }
                console.log('Final config:', this.config);
                break;
            } catch (error) {
                console.log('Error reading config from', path, error);
                continue;
            }
        }
    }

    // New method to initialize WIFI_IFACE
    private async initializeWifiInterface(): Promise<void> {
        try {
            const { stdout } = await execAsync(`nmcli device status | grep "wifi" | awk '{print $1}' | head -n 1`);
            this.WIFI_IFACE = stdout.trim();
            if (!this.WIFI_IFACE) {
                console.error("No Wi-Fi interface found by nmcli!");
                await execAsync('notify-send "Wi-Fi Error" "No Wi-Fi interface found! Check nmcli device status."');
            } else {
                console.log(`Detected Wi-Fi interface: ${this.WIFI_IFACE}`);
            }
        } catch (error) {
            console.error("Error detecting Wi-Fi interface:", error);
            await execAsync('notify-send "Wi-Fi Error" "Failed to detect Wi-Fi interface."');
        }
    }

    private async getScreenDimensions(): Promise<{ width: number; height: number }> {
        try {
            const { stdout } = await execAsync('swaymsg -t get_outputs | jq -r ".[0].current_mode"');
            const [width, height] = stdout.trim().split('x').map(Number);
            return { width, height };
        } catch (error) {
            console.warn("Could not get screen dimensions via swaymsg. Defaulting. Error:", error);
            return { width: 1920, height: 1080 };
        }
    }

    private async getWifiList(): Promise<string> {
        const { stdout } = await execAsync(`nmcli --terse --fields "SSID,SECURITY,SIGNAL" device wifi list --rescan yes`);
        //const { stdout } = await execAsync(`nmcli --terse --fields "SSID,SECURITY,SIGNAL" device wifi list`);
        return stdout;
    }

    private async getCurrentSSID(): Promise<string> {
        const { stdout } = await execAsync('nmcli -t -f active,ssid dev wifi | awk -F: \'$1 ~ /^yes/ {print $2}\'');
        return stdout.trim();
    }

    private async getWifiState(): Promise<string> {
        const { stdout } = await execAsync('nmcli -t -f WIFI g');
        return stdout.trim();
    }

    private async showWofiPrompt(prompt: string, default_value: string = '', isPassword: boolean = false): Promise<string> {
        let wofiCmd = `echo "${default_value}" | wofi -i -d --prompt "${prompt}" --lines 1 --location center --width 500 --height 100`;

        if (isPassword) {
            wofiCmd += ` --pass-display`; // Add this option for password mode
        }

        console.log("Wofi prompt command:", wofiCmd);
        try {
            const { stdout } = await execAsync(wofiCmd);
            return stdout.trim();
        } catch (error: any) {
            if (error.code === 1) {
                console.log("Wofi prompt cancelled by user.");
                return '';
            }
            console.error("Error in showWofiPrompt:", error);
            throw error;
        }
    }

    private async showWofiMenu(options: string[], prompt: string = "Select Wi-Fi Network:"): Promise<string> {
        const input = options.join('\n');
        const menuWidth = 500;
        const menuHeight = Math.max(options.length * 30, 100);

        const positionMap: { [key: number]: string } = {
            0: 'center', 1: 'top_left', 2: 'top', 3: 'top_right',
            4: 'right', 5: 'bottom_right', 6: 'bottom', 7: 'bottom_left', 8: 'left'
        };
        const position = positionMap[this.config.POSITION || 0] || 'center';
        console.log('Using position:', position, 'from config POSITION:', this.config.POSITION);

        const cmd = `echo "${input}" | wofi -i -d --prompt "${prompt}" --lines ${options.length} --location ${position} --width ${menuWidth} --height ${menuHeight}`;
        console.log("Wofi menu command:", cmd);
        try {
            const { stdout } = await execAsync(cmd);
            return stdout.trim();
        } catch (error: any) {
            if (error.code === 1) {
                console.log("Wofi menu cancelled by user.");
                return '';
            }
            console.error("Error in showWofiMenu:", error);
            throw error;
        }
    }

    private async connectToWifi(ssid: string, password?: string): Promise<void> {
        // Determine the connection name to use:
        // Prioritize existing connection named exactly after SSID, otherwise use the 'wifi-' prefixed name.
        let actualConnectionName = `wifi-${ssid}`; // Default to our preferred naming convention

        try {
            // Check if a connection with the exact SSID name already exists
            const { stdout: connectionsList } = await execAsync('nmcli -t connection show');
            const existingSsidConnection = connectionsList.split('\n').find(line => line.startsWith(`${ssid}:`));

            if (existingSsidConnection) {
                // If a connection named exactly by SSID exists, use that name
                actualConnectionName = ssid;
                console.log(`Found existing connection profile named "${ssid}". Using it.`);
            } else {
                console.log(`No existing connection profile found named "${ssid}". Will use "${actualConnectionName}".`);
            }
        } catch (error) {
            console.warn("Could not check for existing connection profile by SSID:", error);
            // Fallback to default `actualConnectionName`
        }


        if (!password) {
            // For open networks (no password)
            const cmd = `nmcli dev wifi con "${ssid}"`; // This command can still work for open networks
            console.log("Connecting (open network) with command:", cmd);
            await execAsync(cmd);
            return;
        }

        // For password-protected networks:
        // Use the determined actualConnectionName for modify/add operations.

        try {
            // Attempt to modify the determined connection name, or implicitly create if it doesn't exist
            const modifyCmd = `nmcli connection modify "${actualConnectionName}" wifi.ssid "${ssid}" wifi-sec.key-mgmt wpa-psk 802-11-wireless-security.psk "${password}"`;
            console.log(`Attempting to modify/create connection "${actualConnectionName}" with command:`, modifyCmd);
            await execAsync(modifyCmd);
        } catch (error: any) {
            // If modify failed (e.g., connectionName doesn't exist under that *exact* name,
            // or modify command failed for another reason), explicitly try to add a new connection.
            console.warn(`Modify connection failed for "${actualConnectionName}", trying to add new. Error: ${error.message}`);
            // If the failure was because `actualConnectionName` didn't exist, we now need to ensure
            // we use our standard `wifi-` prefix for the *new* addition.
            // If `actualConnectionName` was originally `ssid`, and it failed,
            // then we'll try adding `wifi-${ssid}` as a new profile.
            const addNewConnectionName = `wifi-${ssid}`;

            if (!this.WIFI_IFACE) {
                throw new Error("Cannot add new connection: Wi-Fi interface not detected.");
            }
            const addCmd = `nmcli connection add type wifi con-name "${addNewConnectionName}" ifname "${this.WIFI_IFACE}" ssid "${ssid}" wifi-sec.key-mgmt wpa-psk 802-11-wireless-security.psk "${password}"`;
            console.log(`Attempting to add new connection with command "${addNewConnectionName}":`, addCmd);
            await execAsync(addCmd);

            // After adding, the connection name to bring up is the newly added one
            actualConnectionName = addNewConnectionName;
        }

        // After successfully modifying or adding the connection, bring it up.
        const upCmd = `nmcli connection up "${actualConnectionName}"`;
        console.log(`Bringing connection "${actualConnectionName}" up with command:`, upCmd);
        await execAsync(upCmd);
    }

    private async toggleWifi(state: 'on' | 'off'): Promise<void> {
        await execAsync(`nmcli radio wifi ${state}`);
    }

    public async run(): Promise<void> {
        // Ensure the Wi-Fi interface is detected before proceeding
        await this.initializeWifiInterface();
        if (!this.WIFI_IFACE) {
            // Notification already sent in initializeWifiInterface
            return; // Exit if interface not found
        }

        try {
            const currentSSID = await this.getCurrentSSID();
            const wifiState = await this.getWifiState();
            const isEnabled = wifiState.includes('enabled');
            const toggleOption = isEnabled ? 'Toggle Wi-Fi Off' : 'Toggle Wi-Fi On';

            // Rescan Wi-Fi networks and then list them
            //const rawWifiList = await execAsync(`nmcli --terse --fields "SSID,SECURITY,SIGNAL" device wifi list --rescan yes`);
            const rawWifiList = await execAsync(`nmcli --terse --fields "SSID,SECURITY,SIGNAL" device wifi list --rescan no`);
            const wifiNetworks = rawWifiList.stdout.trim().split('\n').map(line => {
                const parts = line.split(':');
                const ssid = parts[0];
                const security = parts[1] || 'None';
                const signal = parts[2] || '0';
                return { ssid, security, signal: parseInt(signal, 10) };
            }).filter(net => net.ssid && net.ssid !== '--'); // Filter out empty or '--' SSIDs

            const displayedNetworkOptions: string[] = [];
            const ssidMap = new Map<string, string>(); // To map displayed string back to clean SSID

            // Add unique networks to options list, prioritize by signal for duplicate SSIDs
            const uniqueNetworks = new Map<string, { ssid: string, security: string, signal: number }>();
            for (const net of wifiNetworks) {
                if (!uniqueNetworks.has(net.ssid) || net.signal > (uniqueNetworks.get(net.ssid)?.signal || 0)) {
                    uniqueNetworks.set(net.ssid, net);
                }
            }

            for (const [ssid, net] of uniqueNetworks.entries()) {
                let displayString = `${net.ssid} (${net.signal}%)`;
                if (net.security && net.security !== 'None') {
                    displayString += ` [${net.security}]`;
                }
                if (net.ssid === currentSSID) {
                    displayString += ' [Connected]';
                }
                displayedNetworkOptions.push(displayString);
                ssidMap.set(displayString, net.ssid); // Map display string to clean SSID
            }

            // Sort options by connection status (connected first), then signal, then alphabetically
            displayedNetworkOptions.sort((a, b) => {
                const aConnected = a.includes('[Connected]');
                const bConnected = b.includes('[Connected]');
                if (aConnected && !bConnected) return -1; // Connected networks first
                if (!aConnected && bConnected) return 1;

                const aSignalMatch = a.match(/\((\d+)%\)/);
                const bSignalMatch = b.match(/\((\d+)%\)/);
                const aSignal = aSignalMatch ? parseInt(aSignalMatch[1]) : 0;
                const bSignal = bSignalMatch ? parseInt(bSignalMatch[1]) : 0;
                if (aSignal !== bSignal) return bSignal - aSignal; // Sort by signal descending

                return a.localeCompare(b); // Alphabetical as tie-breaker
            });


            const menuOptions = [toggleOption, 'Enter SSID Manually', 'Disconnect', ...displayedNetworkOptions];
            const selection = await this.showWofiMenu(menuOptions);

            if (!selection) { // User cancelled Wofi menu
                console.log("Main Wofi menu cancelled.");
                return;
            }

            if (selection === 'Toggle Wi-Fi On') {
                await this.toggleWifi('on');
                await execAsync('notify-send "Wi-Fi" "Wi-Fi enabled."');
            } else if (selection === 'Toggle Wi-Fi Off') {
                await this.toggleWifi('off');
                await execAsync('notify-send "Wi-Fi" "Wi-Fi disabled."');
            } else if (selection === 'Disconnect') {
                if (currentSSID) {
                    // Use the dynamically found interface name
                    await execAsync(`nmcli device disconnect ${this.WIFI_IFACE}`);
                    await execAsync(`notify-send "Wi-Fi" "Disconnected from ${currentSSID}."`);
                } else {
                    await execAsync('notify-send "Wi-Fi" "Not connected to any network."');
                }
            } else if (selection === 'Enter SSID Manually') {
                const manualSSID = await this.showWofiPrompt('Enter SSID:');
                if (!manualSSID) {
                    await execAsync('notify-send "Wi-Fi" "Manual SSID entry cancelled."');
                    return;
                }
                // Call with isPassword = true for the password prompt
                const password = await this.showWofiPrompt(`Enter password for ${manualSSID}:`, '', true);
                if (!password) {
                    await execAsync('notify-send "Wi-Fi" "Password entry cancelled for manual SSID."');
                    return;
                }

                // Attempt connection. If it fails, launch nm-connection-editor.
                try {
                    await this.connectToWifi(manualSSID, password);
                    await execAsync(`notify-send "Wi-Fi" "Attempting to connect to ${manualSSID}..."`);
                } catch (connectError: any) {
                    console.error(`Error connecting to ${manualSSID} via nmcli:`, connectError);
                    await execAsync(`notify-send "Wi-Fi Error" "Failed to connect to ${manualSSID}. Manual configuration may be required. Launching Network Manager Editor."`);
                    // Fallback to nm-connection-editor for complex new connections
                    await execAsync('nm-connection-editor &');
                }

            } else { // User selected a Wi-Fi network from the list
                const ssidToConnect = ssidMap.get(selection); // Get the clean SSID
                if (!ssidToConnect) {
                    await execAsync('notify-send "Error" "Invalid Wi-Fi network selected."');
                    console.error("Failed to map selected option to SSID:", selection);
                    return;
                }

                const { stdout: connectionsList } = await execAsync('nmcli -t connection show');
                const connectionExists = connectionsList.split('\n').some(line => line.startsWith(`${ssidToConnect}:`));

                if (false && connectionExists) {
                    await execAsync(`notify-send "Wi-Fi" "Connecting to saved network: ${ssidToConnect}..."`);
                    try {
                        await execAsync(`nmcli connection up "${ssidToConnect}"`); // Use the saved connection profile
                        await execAsync(`notify-send "Wi-Fi" "Connected to ${ssidToConnect}."`);
                    } catch (connUpError: any) {
                        console.error(`Error connecting to saved profile ${ssidToConnect}:`, connUpError);
                        // If connection up failed, it might still need a password, e.g., if saved password is wrong.
                        const password = await this.showWofiPrompt(`Re-enter password for ${ssidToConnect}:`, '', true);
                        if (password) {
                            // Attempt connection with new password. If it fails, launch nm-connection-editor.
                            try {
                                await execAsync(`notify-send "Wi-Fi" "Re-attempting connection with new password for ${ssidToConnect}..."`);
                                await this.connectToWifi(ssidToConnect, password); // This will use the new robust connectToWifi
                                await execAsync(`notify-send "Wi-Fi" "Connection attempt completed for ${ssidToConnect}."`);
                            } catch (reconnectError: any) {
                                console.error(`Error reconnecting to ${ssidToConnect} with new password:`, reconnectError);
                                await execAsync(`notify-send "Wi-Fi Error" "Failed to connect to ${ssidToConnect}. Manual configuration may be required. Launching Network Manager Editor."`);
                                await execAsync('nm-connection-editor &');
                            }
                        } else {
                            await execAsync(`notify-send "Wi-Fi" "Connection to saved profile failed and no new password provided."`);
                        }
                    }
                } else {
                    // No existing connection profile, prompt for password and create one
                    await execAsync(`notify-send "Wi-Fi" "Connecting to new network: ${ssidToConnect}. Enter password..."`);
                    const password = await this.showWofiPrompt(`Password for ${ssidToConnect}:`, '', true);
                    if (password) {
                        // Attempt connection. If it fails, launch nm-connection-editor.
                        try {
                            await this.connectToWifi(ssidToConnect, password); // This will use the new robust connectToWifi
                            await execAsync(`notify-send "Wi-Fi" "Connection attempt completed for ${ssidToConnect}."`);
                        } catch (connectError: any) {
                            console.error(`Error connecting to ${ssidToConnect} via nmcli:`, connectError);
                            await execAsync(`notify-send "Wi-Fi Error" "Failed to connect to ${ssidToConnect}. Manual configuration may be required. Launching Network Manager Editor."`);
                            await execAsync('nm-connection-editor &');
                        }
                    } else {
                        await execAsync(`notify-send "Wi-Fi" "Connection cancelled: No password provided for ${ssidToConnect}."`);
                    }
                }
            }
        } catch (error) {
            console.error('Error in Wifi4Wofi:', error);
            await execAsync(`notify-send "Wi-Fi Error" "An unhandled error occurred: ${error}"`); // Changed notification to indicate unhandled error
        }
    }
}

// Run the application
const app = new Wifi4Wofi();
app.run();
