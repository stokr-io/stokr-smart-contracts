pragma solidity 0.5.12;

/// @title Ownable
/// @dev Provide a simple access control with a single authority: the owner
contract Ownable {

    // Ethereum address of current owner
    address public owner;

    // Ethereum address of the next owner
    // (has to claim ownership first to become effective owner)
    address public newOwner;

    // @dev Log event on ownership transferred
    // @param previousOwner Ethereum address of previous owner
    // @param newOwner Ethereum address of new owner
    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );

    /// @dev Forbid call by anyone but owner
    modifier onlyOwner() {
        require(msg.sender == owner, "Restricted to owner");
        _;
    }

    /// @dev Deployer account becomes initial owner
    constructor() public {
        owner = msg.sender;
    }

    /// @dev  Transfer ownership to a new Ethereum account (safe method)
    ///       Note: the new owner has to claim his ownership to become effective owner.
    /// @param _newOwner  Ethereum address to transfer ownership to
    function transferOwnership(address _newOwner) public onlyOwner {
        require(_newOwner != address(0x0), "New owner is zero");

        newOwner = _newOwner;
    }

    /// @dev  Transfer ownership to a new Ethereum account (unsafe method)
    ///       Note: It's strongly recommended to use the safe variant via transferOwnership
    ///             and claimOwnership, to prevent accidental transfers to a wrong address.
    /// @param _newOwner  Ethereum address to transfer ownership to
    function transferOwnershipUnsafe(address _newOwner) public onlyOwner {
        require(_newOwner != address(0x0), "New owner is zero");

        _transferOwnership(_newOwner);
    }

    /// @dev  Become effective owner (if dedicated so by previous owner)
    function claimOwnership() public {
        require(msg.sender == newOwner, "Restricted to new owner");

        _transferOwnership(msg.sender);
    }

    /// @dev  Transfer ownership (internal method)
    /// @param _newOwner  Ethereum address to transfer ownership to
    function _transferOwnership(address _newOwner) private {
        if (_newOwner != owner) {
            emit OwnershipTransferred(owner, _newOwner);

            owner = _newOwner;
        }
        newOwner = address(0x0);
    }

}

