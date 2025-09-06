{
  description = "A WiFi menu for Wayland using wofi and NetworkManager";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        
        # Use Bun from nixpkgs
        bun = pkgs.bun;
        
        # Create the package
        wifi4wofi = pkgs.stdenv.mkDerivation rec {
          pname = "wifi4wofi";
          version = "1.0.0";
          
          src = ./.;
          
          nativeBuildInputs = [ bun ];
          
          buildPhase = ''
            # Build the application directly with bun
            ${bun}/bin/bun build src/index.ts --outdir dist --target bun
          '';
          
          installPhase = ''
            # Create bin directory
            mkdir -p $out/bin
            
            # Copy the built application
            cp -r dist $out/
            
            # Create a wrapper script
            cat > $out/bin/wifi4wofi << EOF
            #!${pkgs.bash}/bin/bash
            exec ${bun}/bin/bun $out/dist/index.js "\$@"
            EOF
            
            chmod +x $out/bin/wifi4wofi
          '';
          
          meta = with pkgs.lib; {
            description = "A WiFi menu for Wayland using wofi and NetworkManager";
            homepage = "https://github.com/yourusername/wifi4wofi";
            license = licenses.mit;
            maintainers = [ ];
            platforms = platforms.linux;
          };
        };
        
        # Development shell
        devShell = pkgs.mkShell {
          buildInputs = with pkgs; [
            bun
            wofi
            networkmanager
            jq
            # For Sway users
            sway
            # For other Wayland compositors
            wayland
            # Development tools
            nodePackages.typescript
            nodePackages.typescript-language-server
          ];
          
          shellHook = ''
            echo "Welcome to wifi4wofi development environment!"
            echo "Available commands:"
            echo "  bun run src/index.ts  - Start the application directly"
            echo "  bun build src/index.ts --outdir dist  - Build the application"
            echo "  bun --watch src/index.ts  - Start in development mode"
            echo ""
            echo "Make sure you have NetworkManager and wofi installed on your system."
            echo "Note: This app only uses Node.js built-in modules, no external dependencies needed!"
          '';
        };
        
      in
      {
        packages = {
          default = wifi4wofi;
          wifi4wofi = wifi4wofi;
        };
        
        apps = {
          default = flake-utils.lib.mkApp {
            drv = wifi4wofi;
            exePath = "/bin/wifi4wofi";
          };
          wifi4wofi = flake-utils.lib.mkApp {
            drv = wifi4wofi;
            exePath = "/bin/wifi4wofi";
          };
        };
        
        devShells.default = devShell;
        
        # For NixOS module (optional)
        nixosModules.default = { config, lib, pkgs, ... }: {
          options.services.wifi4wofi = {
            enable = lib.mkEnableOption "wifi4wofi WiFi menu service";
            package = lib.mkOption {
              type = lib.types.package;
              default = wifi4wofi;
              description = "The wifi4wofi package to use";
            };
          };
          
          config = lib.mkIf config.services.wifi4wofi.enable {
            environment.systemPackages = [ config.services.wifi4wofi.package ];
          };
        };
      }
    );
}