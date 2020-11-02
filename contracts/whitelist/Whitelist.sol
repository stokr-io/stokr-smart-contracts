pragma solidity 0.5.16;

import "../ownership/Ownable.sol";


/// @title Whitelist
/// @author STOKR
contract Whitelist is Ownable {

    // Set of admins
    mapping(address => bool) public admins;

    // Set of Whitelisted addresses
    mapping(address => bool) public isWhitelisted;

    /// @dev Log entry on admin added to set
    /// @param admin An Ethereum address
    event AdminAdded(address indexed admin);

    /// @dev Log entry on admin removed from set
    /// @param admin An Ethereum address
    event AdminRemoved(address indexed admin);

    /// @dev Log entry on investor added set
    /// @param admin An Ethereum address
    /// @param investor An Ethereum address
    event InvestorAdded(address indexed admin, address indexed investor);

    /// @dev Log entry on investor removed from set
    /// @param admin An Ethereum address
    /// @param investor An Ethereum address
    event InvestorRemoved(address indexed admin, address indexed investor);

    /// @dev Only admin
    modifier onlyAdmin() {
        require(admins[msg.sender], "Restricted to whitelist admin");
        _;
    }

    /// @dev Add admin to set
    /// @param _admin An Ethereum address
    function addAdmin(address _admin) public onlyOwner {
        require(_admin != address(0x0), "Whitelist admin is zero");

        if (!admins[_admin]) {
            admins[_admin] = true;

            emit AdminAdded(_admin);
        }
    }

    /// @dev Remove admin from set
    /// @param _admin An Ethereum address
    function removeAdmin(address _admin) public onlyOwner {
        require(_admin != address(0x0), "Whitelist admin is zero");  // Necessary?

        if (admins[_admin]) {
            admins[_admin] = false;

            emit AdminRemoved(_admin);
        }
    }

    /// @dev Add investor to set of whitelisted addresses
    /// @param _investors A list where each entry is an Ethereum address
    function addToWhitelist(address[] calldata _investors) external onlyAdmin {
        for (uint256 i = 0; i < _investors.length; i++) {
            if (!isWhitelisted[_investors[i]]) {
                isWhitelisted[_investors[i]] = true;

                emit InvestorAdded(msg.sender, _investors[i]);
            }
        }
    }

    /// @dev Remove investor from set of whitelisted addresses
    /// @param _investors A list where each entry is an Ethereum address
    function removeFromWhitelist(address[] calldata _investors) external onlyAdmin {
        for (uint256 i = 0; i < _investors.length; i++) {
            if (isWhitelisted[_investors[i]]) {
                isWhitelisted[_investors[i]] = false;

                emit InvestorRemoved(msg.sender, _investors[i]);
            }
        }
    }

}
