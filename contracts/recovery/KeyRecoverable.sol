pragma solidity 0.4.24;

import "../ownership/Ownable.sol";


/// @title KeyRecoverable
/// @author STOKR
contract KeyRecoverable is Ownable {

    // Address that can do the KeyRecovery
    address public keyRecoverer;

    /// @dev Event emitted when the KeyRecoverer changes
    /// @param newKeyRecoverer Ethereum address of new KeyRecoverer
    event KeyRecovererChange(address indexed newKeyRecoverer);

    /// @dev Event emitted in case of a KeyRecovery
    /// @param oldAddress Ethereum address of old account
    /// @param newAddress Ethereum address of new account
    event KeyRecovery(address indexed oldAddress, address indexed newAddress);

    /// @dev Ensure only key recoverer
    modifier onlyKeyRecoverer() {
        require(msg.sender == keyRecoverer, "Restricted to key recoverer");
        _;
    }

    /// @dev Constructor
    /// @param _keyRecoverer address
    constructor(address _keyRecoverer) public {
        setKeyRecoverer(_keyRecoverer);
    }

    /// @dev Set key recoverer
    /// @param _newKeyRecoverer address
    function setKeyRecoverer(address _newKeyRecoverer) public onlyOwner {
        require(_newKeyRecoverer != address(0x0), "New key recoverer is zero");

        if (keyRecoverer != address(0x0) && _newKeyRecoverer != keyRecoverer) {
            emit KeyRecovererChange(_newKeyRecoverer);
        }
        keyRecoverer = _newKeyRecoverer;
    }

    /// @dev Recover key
    /// @param _oldAddress address
    /// @param _newAddress address
    function recoverKey(address _oldAddress, address _newAddress) public;

}
