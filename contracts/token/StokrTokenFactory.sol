pragma solidity 0.5.16;

import "../whitelist/Whitelist.sol";
import "./StokrToken.sol";

// Helper contract to deploy a new StokrToken contract

contract StokrTokenFactory {

    function createNewToken(
        string memory name,
        string memory symbol,
        Whitelist whitelist,
        address profitDepositor,
        address profitDistributor,
        address tokenRecoverer
    )
        public
        returns (StokrToken)
    {
        StokrToken token = new StokrToken(
            name,
            symbol,
            whitelist,
            profitDepositor,
            profitDistributor,
            tokenRecoverer);

        token.transferOwnershipUnsafe(msg.sender);

        return token;
    }

}
