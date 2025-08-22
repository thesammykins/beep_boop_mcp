#!/bin/bash

# Beep/Boop MCP Server Configuration Selector
# Usage: ./select-config.sh [environment]

set -e

echo "🔧 Beep/Boop MCP Server Configuration Selector"
echo

# Available configurations
CONFIGS=(
    "development:Fast cleanup, debug logging, ingress disabled"
    "production:Balanced settings, Slack ingress, production stability"  
    "ci:Aggressive cleanup, minimal logging, CI/CD optimized"
    "enterprise:Team prefixes, full ingress, notifications, compliance"
)

# Function to show available configurations
show_configs() {
    echo "Available configurations:"
    for i in "${!CONFIGS[@]}"; do
        IFS=':' read -r name desc <<< "${CONFIGS[$i]}"
        echo "  $((i+1)). $name - $desc"
    done
    echo
}

# Function to apply configuration
apply_config() {
    local env=$1
    local config_file="mcp-config.${env}.json"
    
    if [[ ! -f "$config_file" ]]; then
        echo "❌ Configuration file '$config_file' not found!"
        exit 1
    fi
    
    echo "📋 Applying $env configuration..."
    cp "$config_file" "mcp-config.json"
    echo "✅ Configuration applied: $config_file -> mcp-config.json"
    
    # Show key settings
    echo
    echo "🔍 Key settings:"
    if command -v jq >/dev/null 2>&1; then
        echo "   Max age: $(jq -r '.mcpServers[].env.BEEP_BOOP_DEFAULT_MAX_AGE_HOURS // "24"' mcp-config.json) hours"
        echo "   Auto cleanup: $(jq -r '.mcpServers[].env.BEEP_BOOP_AUTO_CLEANUP_ENABLED // "false"' mcp-config.json)"
        echo "   Log level: $(jq -r '.mcpServers[].env.BEEP_BOOP_LOG_LEVEL // "info"' mcp-config.json)"
        echo "   Backup enabled: $(jq -r '.mcpServers[].env.BEEP_BOOP_BACKUP_ENABLED // "false"' mcp-config.json)"
        echo "   Ingress enabled: $(jq -r '.mcpServers[].env.BEEP_BOOP_INGRESS_ENABLED // "false"' mcp-config.json)"
        echo "   Ingress provider: $(jq -r '.mcpServers[].env.BEEP_BOOP_INGRESS_PROVIDER // "none"' mcp-config.json)"
        echo "   Notifications: $(jq -r '.mcpServers[].env.BEEP_BOOP_ENABLE_NOTIFICATIONS // "false"' mcp-config.json)"
        echo "   Notification service: $(jq -r '.mcpServers[].env.BEEP_BOOP_NOTIFICATION_SERVICE // "none"' mcp-config.json)"
    else
        echo "   (Install 'jq' to see detailed settings)"
    fi
}

# Main logic
if [[ $# -eq 0 ]]; then
    # Interactive mode
    show_configs
    echo "Select configuration (1-${#CONFIGS[@]}) or environment name:"
    read -r choice
    
    if [[ "$choice" =~ ^[0-9]+$ ]] && (( choice >= 1 && choice <= ${#CONFIGS[@]} )); then
        # Numeric choice
        IFS=':' read -r env desc <<< "${CONFIGS[$((choice-1))]}"
        apply_config "$env"
    elif [[ "$choice" =~ ^(development|production|ci|enterprise)$ ]]; then
        # Direct environment name
        apply_config "$choice"
    else
        echo "❌ Invalid choice: $choice"
        exit 1
    fi
else
    # Command line argument
    env=$1
    if [[ "$env" =~ ^(development|production|ci|enterprise)$ ]]; then
        apply_config "$env"
    else
        echo "❌ Invalid environment: $env"
        echo
        show_configs
        exit 1
    fi
fi

# Show setup guidance based on configuration
echo
if command -v jq >/dev/null 2>&1; then
    ingress_enabled=$(jq -r '.mcpServers[].env.BEEP_BOOP_INGRESS_ENABLED // "false"' mcp-config.json)
    notifications_enabled=$(jq -r '.mcpServers[].env.BEEP_BOOP_ENABLE_NOTIFICATIONS // "false"' mcp-config.json)
    
    if [[ "$ingress_enabled" == "true" ]]; then
        echo "📡 Ingress Setup Required:"
        echo "   1. Configure Discord/Slack bot tokens (replace {{TOKEN}} placeholders)"
        echo "   2. Start ingress listener: npm run listen"
        echo "   3. See docs/INGRESS.md for detailed setup instructions"
        echo
    fi
    
    if [[ "$notifications_enabled" == "true" ]]; then
        echo "🔔 Webhook Setup Required:"
        echo "   1. Configure webhook URLs (replace {{WEBHOOK_URL}} placeholders)"
        echo "   2. Test webhooks: npm run test:webhooks"
        echo "   3. See WEBHOOKS.md for setup instructions"
        echo
    fi
else
    ingress_enabled="unknown"
    notifications_enabled="unknown"
fi

echo
echo "🚀 Ready to start the server with:"
echo "   npm run dev    # Development mode"
echo "   npm start      # Production mode"
if [[ "$ingress_enabled" == "true" ]]; then
    echo "   npm run listen # Ingress/listener mode (Discord/Slack)"
fi
echo
echo "📚 View configuration details:"
echo "   cat mcp-config.json"
echo "   cat CONFIGURATION.md"
if [[ "$ingress_enabled" == "true" ]]; then
    echo "   cat docs/INGRESS.md"
fi
