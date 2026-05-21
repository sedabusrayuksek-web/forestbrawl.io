#!/bin/bash

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting ForestBrawl.io API Tests${NC}"
echo "================================="

# Start server in background
PORT=8080 node --enable-source-maps artifacts/api-server/dist/index.mjs &
SERVER_PID=$!

# Wait for server to start
sleep 2

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function for tests
test_endpoint() {
  local name=$1
  local method=$2
  local url=$3
  local data=$4
  local expected_code=$5

  echo -n "Testing: $name ... "

  if [ "$method" = "GET" ]; then
    response=$(curl -s -w "\n%{http_code}" "$url")
  else
    response=$(curl -s -w "\n%{http_code}" -X "$method" -H "Content-Type: application/json" -d "$data" "$url")
  fi

  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)

  if [ "$http_code" = "$expected_code" ]; then
    echo -e "${GREEN}PASS${NC} (HTTP $http_code)"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}FAIL${NC} (Expected $expected_code, got $http_code)"
    echo "Response: $body"
    ((TESTS_FAILED++))
  fi
}

# Run tests
echo ""
echo "API Tests:"
echo "---------"

# Health check
test_endpoint "Health Check" "GET" "http://localhost:8080/api/healthz" "" "200"

# Registration
test_endpoint "Register User" "POST" "http://localhost:8080/api/auth/register" '{"username":"testuser123","email":"test@example.com","password":"password123"}' "200"

# Login
test_endpoint "Login User" "POST" "http://localhost:8080/api/auth/login" '{"username":"testuser123","password":"password123"}' "200"

# Get leaderboard
test_endpoint "Get Leaderboard" "GET" "http://localhost:8080/api/leaderboard?tab=daily" "" "200"

# Check frontend
echo ""
echo "Frontend Tests:"
echo "--------------"
test_endpoint "Frontend Index" "GET" "http://localhost:8080/forestbrawl/" "" "200"
test_endpoint "Frontend Play" "GET" "http://localhost:8080/forestbrawl/play.html" "" "200"
test_endpoint "Socket.io JS" "GET" "http://localhost:8080/forestbrawl/socket.io.js" "" "200"

# Summary
echo ""
echo "================================="
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"

# Cleanup
kill $SERVER_PID 2>/dev/null

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}Some tests failed!${NC}"
  exit 1
fi
