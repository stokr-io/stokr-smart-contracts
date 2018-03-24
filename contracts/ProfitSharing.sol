pragma solidity 0.4.19;

import "../zeppelin-solidity/contracts/ownership/Ownable.sol";
import "../zeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "../zeppelin-solidity/contracts/math/SafeMath.sol";


/// @title ProfitSharing
/// @author Autogenerated from a Dia UML diagram
contract ProfitSharing is Ownable {

    using SafeMath for uint;

    struct InvestorAccount {
        uint balance;
        uint lastTotalProfits;
        uint profitShare;
    }

    mapping(address => InvestorAccount) public accounts;
    uint public totalProfits;

    // As long as the total supply isn't fixed, i.e. new tokens can appear out of thin air,
    // the investors' profit shares aren't determined.
    bool public totalSupplyIsFixed;
    uint internal totalSupply_;

    /// @dev Log entry on profit deposited
    /// @param depositor An Ethereum address
    /// @param amount A positive number
    event ProfitDeposited(address depositor, uint amount);

    /// @dev Log entry on profit share updated
    /// @param investor An Ethereum address
    /// @param amount A positive number
    event ProfitShareUpdated(address investor, uint amount);

    /// @dev Log entry on profit withdrawal
    /// @param investor An Ethereum address
    /// @param amount A positive number
    event ProfitWithdrawal(address investor, uint amount);

    /// @dev Deposit profit
    function depositProfit() public payable {
        totalProfits = totalProfits.add(msg.value);

        ProfitDeposited(msg.sender, msg.value);
    }

    /// @dev Profit share owing
    /// @param _investor An Ethereum address
    /// @return A positive number
    function profitShareOwing(address _investor) public view returns (uint) {
        return totalSupplyIsFixed && totalSupply_ > 0
             ? totalProfits.sub(accounts[_investor].lastTotalProfits)
                           .mul(accounts[_investor].balance)
                           .div(totalSupply_)  // <- The linter doesn't like this.
             : 0;
    }

    /// @dev Update profit share
    /// @param _investor An Ethereum address
    function updateProfitShare(address _investor) public {
        require(totalSupplyIsFixed);

        uint additionalProfitShare =  profitShareOwing(_investor);

        accounts[_investor].lastTotalProfits = totalProfits;
        accounts[_investor].profitShare = accounts[_investor].profitShare.add(additionalProfitShare);

        ProfitShareUpdated(_investor, additionalProfitShare);
    }

    /// @dev Withdraw profit share
    function withdrawProfitShare() public {
        updateProfitShare(msg.sender);

        uint withdrawnProfitShare = accounts[msg.sender].profitShare;

        accounts[msg.sender].profitShare = 0;
        msg.sender.transfer(withdrawnProfitShare);

        ProfitWithdrawal(msg.sender, withdrawnProfitShare);
    }

}
