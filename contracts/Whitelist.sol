pragma solidity 0.4.19;

import "../zeppelin-solidity/contracts/ownership/Ownable.sol";


/// @title Whitelist
/// @author Autogenerated from a Dia UML diagram
contract Whitelist is Ownable {

    mapping(address => bool) public admins;
    mapping(address => bool) public isWhitelisted;

    /// @dev Log entry on admin added
    /// @param admin An Ethereum address
    event AdminAdded(address admin);

    /// @dev Log entry on admin removed
    /// @param admin An Ethereum address
    event AdminRemoved(address admin);

    /// @dev Log entry on investor added
    /// @param admin An Ethereum address
    /// @param investor An Ethereum address
    event InvestorAdded(address admin, address investor);

    /// @dev Log entry on investor removed
    /// @param admin An Ethereum address
    /// @param investor An Ethereum address
    event InvestorRemoved(address admin, address investor);

    /// @dev Only admin
    modifier onlyAdmin() {
        require(admins[msg.sender]);
        _;
    }

    /// @dev Add admin
    /// @param _admin An Ethereum address
    function addAdmin(address _admin) public onlyOwner {
        if (!admins[_admin]) {
            admins[_admin] = true;
            AdminAdded(_admin);
        }
    }

    /// @dev Remove admin
    /// @param _admin An Ethereum address
    function removeAdmin(address _admin) public onlyOwner {
        if (admins[_admin]) {
            admins[_admin] = false;
            AdminRemoved(_admin);
        }
    }

    /// @dev Add to whitelist
    /// @param _investors A list where each entry is an Ethereum address
    function addToWhitelist(address[] _investors) public onlyAdmin {
        for (uint256 i = 0; i < _investors.length; i++) {
            if (!isWhitelisted[_investors[i]]) {
                isWhitelisted[_investors[i]] = true;
                InvestorAdded(msg.sender, _investors[i]);
            }
        }
    }

    /// @dev Remove from whitelist
    /// @param _investors A list where each entry is an Ethereum address
    function removeFromWhitelist(address[] _investors) public onlyAdmin {
        for (uint256 i = 0; i < _investors.length; i++) {
            if (isWhitelisted[_investors[i]]) {
                isWhitelisted[_investors[i]] = false;
                InvestorRemoved(msg.sender, _investors[i]);
            }
        }
    }

}
