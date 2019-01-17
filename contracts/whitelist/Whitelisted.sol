pragma solidity 0.4.24;

import "../ownership/Ownable.sol";
import "./Whitelist.sol";


/// @title Whitelisted
/// @author STOKR
contract Whitelisted is Ownable {

    Whitelist public whitelist;

    /// @dev Event when whitelist is changed
    /// @param newWhitelist An Ethereum address
    event WhitelistChanged(address indexed newWhitelist);

    /// @dev Ensure only whitelisted addresses can call
    modifier onlyWhitelisted(address _address) {
        require(whitelist.isWhitelisted(_address), "Address is not whitelisted");
        _;
    }

    /// @dev Constructor
    /// @param _whitelist address of whitelist contract
    constructor(Whitelist _whitelist) public {
        setWhitelist(_whitelist);
    }

    /// @dev Set the address of whitelist
    /// @param _newWhitelist An Ethereum address
    function setWhitelist(Whitelist _newWhitelist) public onlyOwner {
        require(address(_newWhitelist) != address(0x0), "Whitelist address is zero");

        if (address(whitelist) != address(0x0) && address(_newWhitelist) != address(whitelist)) {
            emit WhitelistChanged(address(_newWhitelist));
        }
        whitelist = Whitelist(_newWhitelist);
    }

}
