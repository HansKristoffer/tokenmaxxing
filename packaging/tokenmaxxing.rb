# Template: the release workflow fills in $VERSION / $SHA_* and pushes it to
# HansKristoffer/homebrew-tap as Casks/tokenmaxxing.rb.
cask "tokenmaxxing" do
  arch arm: "arm64", intel: "x86_64"

  version "$VERSION"
  sha256 arm:   "$SHA_ARM",
         intel: "$SHA_INTEL"

  url "https://github.com/HansKristoffer/tokenmaxxing/releases/download/v#{version}/Tokenmaxxing-#{version}-#{arch}.zip"
  name "Tokenmaxxing"
  desc "Menu bar leaderboard for AI coding agent token usage"
  homepage "https://github.com/HansKristoffer/tokenmaxxing"

  depends_on macos: ">= :sonoma"

  app "Tokenmaxxing.app"

  uninstall quit: "dk.hanskristoffer.tokenmaxxing"

  zap trash: [
    "~/Library/Application Support/Tokenmaxxing",
    "~/Library/Logs/Tokenmaxxing",
    "~/Library/Preferences/dk.hanskristoffer.tokenmaxxing.plist",
  ]
end
