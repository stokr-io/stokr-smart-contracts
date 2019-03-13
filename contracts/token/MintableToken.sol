pragma solidity 0.4.25;

import "../whitelist/Whitelisted.sol";
import "./ERC20.sol";
import "./ProfitSharing.sol";


/// @title MintableToken
/// @author STOKR
/// @dev Extension of the ERC20 compliant ProfitSharing Token
///      that allows the creation of tokens via minting for a
///      limited time period (until minting gets finished).
contract MintableToken is ERC20, ProfitSharing, Whitelisted {

    address public minter;
    uint public numberOfInvestors = 0;

    /// @dev Log entry on mint
    /// @param to Beneficiary who received the newly minted tokens
    /// @param amount The amount of minted token units
    event Minted(address indexed to, uint amount);

    /// @dev Log entry on mint finished
    event MintFinished();

    /// @dev Restrict an operation to be callable only by the minter
    modifier onlyMinter() {
        require(msg.sender == minter, "Restricted to minter");
        _;
    }

    /// @dev Restrict an operation to be executable only while minting was not finished
    modifier canMint() {
        require(!totalSupplyIsFixed, "Total supply has been fixed");
        _;
    }

    /// @dev Set minter authority
    /// @param _minter Ethereum address of minter authority
    function setMinter(address _minter) public onlyOwner {
        require(minter == address(0x0), "Minter has already been set");
        require(_minter != address(0x0), "Minter is zero");

        minter = _minter;
    }

    /// @dev Mint tokens, i.e. create tokens out of thin air
    /// @param _to Beneficiary who will receive the newly minted tokens
    /// @param _amount The amount of minted token units
    function mint(address _to, uint _amount) public onlyMinter canMint onlyWhitelisted(_to) {
        if (accounts[_to].balance == 0) {
            numberOfInvestors++;
        }

        totalSupply_ = totalSupply_.add(_amount);
        accounts[_to].balance = accounts[_to].balance.add(_amount);

        emit Minted(_to, _amount);
        emit Transfer(address(0x0), _to, _amount);
    }

    /// @dev Finish minting -- this should be irreversible
    function finishMinting() public onlyMinter canMint {
        totalSupplyIsFixed = true;

        emit MintFinished();
    }

}

