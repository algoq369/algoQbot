#!/bin/bash

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m'

pm2 logs algoqbot 2>&1 | while read line; do
  if echo "$line" | grep -qi "error"; then
    echo -e "${RED}$line${NC}"
  elif echo "$line" | grep -qi "warn"; then
    echo -e "${YELLOW}$line${NC}"
  elif echo "$line" | grep -qi "success\|✅\|online"; then
    echo -e "${GREEN}$line${NC}"
  elif echo "$line" | grep -qi "info\|📊\|🤖"; then
    echo -e "${CYAN}$line${NC}"
  elif echo "$line" | grep -qi "debug"; then
    echo -e "${GRAY}$line${NC}"
  elif echo "$line" | grep -qi "position.*entered\|buy\|shadow trade.*buy"; then
    echo -e "${GREEN}$line${NC}"
  elif echo "$line" | grep -qi "position.*exited\|sell\|shadow trade.*sell"; then
    echo -e "${MAGENTA}$line${NC}"
  elif echo "$line" | grep -qi "shadow\|👻"; then
    echo -e "${BLUE}$line${NC}"
  else
    echo "$line"
  fi
done
