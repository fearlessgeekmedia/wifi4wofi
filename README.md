# wifi4wofi

A WiFi menu for Wayland using wofi and NetworkManager, written in TypeScript and compiled with Bun.

## Prerequisites

- [Bun](https://bun.sh/) - JavaScript runtime and package manager
- [wofi](https://hg.sr.ht/~scoopta/wofi) - Wayland menu application
- [NetworkManager](https://networkmanager.dev/) - Network connection manager
- [yad](https://github.com/v1cont/yad) - Yet Another Dialog for GUI dialogs
- [jq](https://jqlang.github.io/jq/) - JSON processor

## Installation

### Option 1: Nix/NixOS (Recommended)

This project includes a Nix flake for easy installation and development.

#### Quick Start
```bash
# Run directly without installation
nix run github:yourusername/wifi4wofi

# Or clone and run locally
git clone https://github.com/yourusername/wifi4wofi.git
cd wifi4wofi
nix run
```

#### Development Environment
```bash
# Enter development shell with all dependencies
nix develop

# Build the package
nix build

# Install to your profile
nix profile install
```

#### NixOS System Integration
Add to your `configuration.nix`:
```nix
{
  imports = [
    (builtins.getFlake "github:yourusername/wifi4wofi").nixosModules.default
  ];
  
  services.wifi4wofi.enable = true;
}
```

### Option 2: Manual Installation

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

#### Installing System Dependencies

**On NixOS:**
```bash
nix-env -iA nixos.networkmanager nixos.wofi nixos.yad nixos.jq
```

**On Ubuntu/Debian:**
```bash
sudo apt install network-manager wofi yad jq
```

**On Arch Linux:**
```bash
sudo pacman -S networkmanager wofi yad jq
```

**On Fedora:**
```bash
sudo dnf install NetworkManager wofi yad jq
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

### With Nix
```bash
# Run the application
nix run

# Or if installed to profile
wifi4wofi
```

### With Bun (Manual Installation)
```bash
# Run the application
bun run start

# Or run directly
bun run src/index.ts
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

### With Nix
```bash
# Build the package
nix build

# The result will be in ./result/bin/wifi4wofi
```

### With Bun (Manual Installation)
```bash
# Build the application
bun run build

# The compiled output will be in the `dist` directory
```

## Development

### With Nix (Recommended)
```bash
# Enter development environment
nix develop

# Available commands in dev shell:
bun run src/index.ts                    # Start the application directly
bun build src/index.ts --outdir dist    # Build the application
bun --watch src/index.ts                # Start in development mode
```

### With Bun
```bash
# Install dependencies
bun install

# Start in development mode
bun run dev

# Build for production
bun run build
```

## Nix Flake Features

The included Nix flake provides:

- **Reproducible Builds**: Consistent environment across different systems
- **All Dependencies Included**: No need to manually install system packages
- **Development Shell**: Complete development environment with all tools
- **Easy Installation**: Simple commands to build, run, and install
- **NixOS Integration**: Optional system service configuration

### Flake Outputs

- `packages.default`: The built application
- `apps.default`: Executable app via `nix run`
- `devShells.default`: Development environment
- `nixosModules.default`: NixOS system integration

## Troubleshooting

### Nix Issues
```bash
# If you encounter temporary file issues with nix develop
nix develop --accept-flake-config

# Update flake inputs
nix flake update
```

### Missing Dependencies
Ensure you have all required system packages installed. With Nix, this is handled automatically, but for manual installation:

```bash
# Check if required tools are available
which wofi networkmanager yad jq
```

### Wayland Compositor
Make sure you're running a Wayland compositor like Sway, Hyprland, or similar. The application won't work with X11-only window managers.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
