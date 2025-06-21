# wifi4wofi

A WiFi menu for Wayland using wofi and NetworkManager, written in TypeScript and compiled with Bun.

## Prerequisites

- [Bun](https://bun.sh/) - JavaScript runtime and package manager
- [wofi](https://hg.sr.ht/~scoopta/wofi) - Wayland menu application
- [NetworkManager](https://networkmanager.dev/) - Network connection manager

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/wifi4wofi.git
cd wifi4wofi
```

2. Install dependencies:
```bash
bun install
```

3. Build the application:
```bash
bun run build
```

## Configuration

You can configure the application by creating a `config` file in the project directory or at `~/.config/wofi/wifi`. The following options are available:

```bash
FIELDS=SSID,SECURITY  # Fields to display in the WiFi list
POSITION=0           # Menu position
YOFF=0              # Y offset
XOFF=0              # X offset
```

## Usage

Run the application:
```bash
bun run start
```

The application will:
1. Show a scanning dialog
2. Display a list of available WiFi networks
3. Allow you to:
   - Connect to a network
   - Toggle WiFi on/off
   - Manually enter network details
   - Enter passwords for secured networks

## Building

To build the application for distribution:
```bash
bun run build
```

The compiled output will be in the `dist` directory.

### by mohyddin
to build a binary 

```bash
bun build --compile src/index.ts --outfile wifi4wofi
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
