// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// ═══════════════════════════════════════════════════════════════════════════════
// XALICAN SPLITTER — Immutable. No admin. No upgradeability.
// Routes 99.9% of all extracted value to Xalican treasury.
// Routes fixed $1M (tier 1) or $10M (tier 2) to executing buyer.
// Deployed once per chain. Never redeployed.
// ═══════════════════════════════════════════════════════════════════════════════

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract XalicanSplitter {
    address public immutable TREASURY = 0xCCCF1C9A2154750A0D7CceeD51fE0f9b4c1906e8;
    uint256 public constant TIER1_PAYOUT = 1_000_000e6;   // $1M in USDC (6 decimals)
    uint256 public constant TIER2_PAYOUT = 10_000_000e6;  // $10M in USDC

    // ── SPLIT — called at end of every bundle execution ──────────────────────
    function split(address usdc, address buyer, bool tier2) external {
        uint256 total = IERC20(usdc).balanceOf(address(this));
        require(total > 0, "Nothing to split");

        uint256 buyerPayout = tier2 ? TIER2_PAYOUT : TIER1_PAYOUT;
        if (total < buyerPayout) buyerPayout = total;

        uint256 treasuryAmount = total - buyerPayout;

        if (buyerPayout > 0) {
            IERC20(usdc).transfer(buyer, buyerPayout);
        }
        if (treasuryAmount > 0) {
            IERC20(usdc).transfer(TREASURY, treasuryAmount);
        }
    }

    // ── EMERGENCY SWEEP — only treasury can call ─────────────────────────────
    function sweep(address usdc) external {
        require(msg.sender == TREASURY, "Only treasury");
        uint256 bal = IERC20(usdc).balanceOf(address(this));
        if (bal > 0) IERC20(usdc).transfer(TREASURY, bal);
    }

    receive() external payable {}
}
