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
                    if (line.trim().startsWith('#')) continue; // Skip comments
                    const [key, value] = line.split('=');
                    if (key && value) {
                        const trimmedKey = key.trim();
                        const trimmedValue = value.trim();
                        // Convert numeric values
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

    private async getScreenDimensions(): Promise<{ width: number; height: number }> {
        const { stdout } = await execAsync('swaymsg -t get_outputs | jq -r ".[0].current_mode"');
        const [width, height] = stdout.trim().split('x').map(Number);
        return { width, height };
    }

    private async getWifiList(): Promise<string> {
        const { stdout } = await execAsync(`nmcli --terse --fields "${this.config.FIELDS}" device wifi list | awk '!seen[$1]++'`);
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

    private async showWofiMenu(options: string[]): Promise<string> {
        const input = options.join('\n');
        const menuWidth = 500;
        // Calculate height based on number of options (approximately 30px per line)
        const menuHeight = Math.max(options.length * 30, 100); // Ensure minimum height of 100px

        // Map position numbers to wofi location values
        const positionMap: { [key: number]: string } = {
            0: 'center',
            1: 'top_left',
            2: 'top',
            3: 'top_right',
            4: 'right',
            5: 'bottom_right',
            6: 'bottom',
            7: 'bottom_left',
            8: 'left'
        };
        const position = positionMap[this.config.POSITION || 0] || 'center';
        console.log('Using position:', position, 'from config POSITION:', this.config.POSITION);

        const { stdout } = await execAsync(`echo "${input}" | wofi -i -d --prompt "Wi-Fi SSID: " --lines ${options.length} --location ${position} --width ${menuWidth} --height ${menuHeight}`);
        return stdout.trim();
    }

    private async connectToWifi(ssid: string, password?: string): Promise<void> {
        if (password) {
            await execAsync(`nmcli dev wifi con "${ssid}" password "${password}"`);
        } else {
            await execAsync(`nmcli dev wifi con "${ssid}"`);
        }
    }

    private async toggleWifi(state: 'on' | 'off'): Promise<void> {
        await execAsync(`nmcli radio wifi ${state}`);
    }

    public async run(): Promise<void> {
        try {
            const [wifiList, currentSSID, wifiState] = await Promise.all([
                this.getWifiList(),
                this.getCurrentSSID(),
                this.getWifiState()
            ]);

            const isEnabled = wifiState.includes('enabled');
            const toggleOption = isEnabled ? 'toggle off' : 'toggle on';

            const menuOptions = [toggleOption, 'manual', ...wifiList.split('\n')];
            const selection = await this.showWofiMenu(menuOptions);

            if (selection === 'manual') {
                const manualInput = await this.showWofiMenu(['enter the SSID of the network (SSID,password)']);
                const [ssid, password] = manualInput.split(',');
                await this.connectToWifi(ssid, password);
            } else if (selection === 'toggle on') {
                await this.toggleWifi('on');
            } else if (selection === 'toggle off') {
                await this.toggleWifi('off');
            } else {
                const ssid = selection.split(/\s{2,}/)[0];
                const { stdout: connections } = await execAsync('nmcli -t connection show');

                if (connections.includes(ssid)) {
                    await execAsync(`nmcli con up "${ssid}"`);
                } else {
                    const password = await this.showWofiMenu(['if connection is stored, hit enter']);
                    await this.connectToWifi(ssid, password);
                }
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }
}

// Run the application
const app = new Wifi4Wofi();
app.run(); 
