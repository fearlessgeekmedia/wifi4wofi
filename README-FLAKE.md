# Nix Flake for wifi4wofi

This directory contains a Nix flake for building and running the wifi4wofi application.

## Features

- **Latest Bun Support**: Uses Bun from nixpkgs for fast TypeScript execution
- **No External Dependencies**: The application only uses Node.js built-in modules
- **Complete Development Environment**: Includes all necessary tools for development
- **Easy Installation**: Simple commands to build, run, and install

## Usage

### Building the Package
```bash
nix build
```

### Running the Application
```bash
nix run
```

### Development Environment
```bash
nix develop
```

### Installing to Profile
```bash
nix profile install
```

## Prerequisites

The application requires:
- **NetworkManager**: For WiFi management
- **wofi**: Wayland menu application
- **jq**: JSON processing (used for screen dimensions)
- **yad**: Yet Another Dialog for GUI dialogs
- **Wayland compositor**: Such as Sway, Hyprland, etc.

## Configuration

Create a config file at either:
- `./config` (in the project directory)
- `~/.config/wofi/wifi`

Example configuration:
```bash
FIELDS=SSID,SECURITY  # Fields to display in the WiFi list
POSITION=0           # Menu position (0=center, 1=top_left, etc.)
YOFF=0              # Y offset
XOFF=0              # X offset
```

## Development

The development shell provides:
- Bun runtime
- TypeScript compiler
- TypeScript language server
- All system dependencies (wofi, NetworkManager, jq, etc.)

### Available Commands in Dev Shell
```bash
bun run src/index.ts                    # Start the application directly
bun build src/index.ts --outdir dist    # Build the application
bun --watch src/index.ts                # Start in development mode
```

## Flake Outputs

- `packages.default`: The built application
- `packages.wifi4wofi`: Same as default
- `apps.default`: Executable app via `nix run`
- `apps.wifi4wofi`: Same as default
- `devShells.default`: Development environment
- `nixosModules.default`: Optional NixOS system integration

## Troubleshooting

### Development Shell Issues
If you encounter temporary file issues with `nix develop`, try:
```bash
nix develop --accept-flake-config
```

### Missing Dependencies
Ensure you have NetworkManager, wofi, and yad installed on your system:
```bash
# On NixOS
nix-env -iA nixos.networkmanager nixos.wofi nixos.yad

# On other systems, install via your package manager
```

### Wayland Compositor
Make sure you're running a Wayland compositor like Sway, Hyprland, or similar.