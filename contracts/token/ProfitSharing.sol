pragma solidity 0.4.24;

import "../math/SafeMath.sol";
import "../ownership/Ownable.sol";


/// @title ProfitSharing
/// @author STOKR
contract ProfitSharing is Ownable {

    using SafeMath for uint;


    // An InvestorAccount object keeps track of the investor's
    // - balance: amount of tokens he/she holds (always up-to-date)
    // - profitShare: amount of wei this token owed him/her at the last update
    // - lastTotalProfits: determines when his/her profitShare was updated
    // Note, this construction requires:
    // - totalProfits to never decrease
    // - totalSupply to be fixed
    // - profitShare of all involved parties to get updated prior to any token transfer
    // - lastTotalProfits to be set to current totalProfits upon profitShare update
    struct InvestorAccount {
        uint balance;           // token balance
        uint lastTotalProfits;  // totalProfits [wei] at the time of last profit share update
        uint profitShare;       // profit share [wei] of last update
    }


    // Investor account database
    mapping(address => InvestorAccount) public accounts;

    // Authority who is allowed to deposit profits [wei] on this
    address public profitDepositor;

    // Authority who is allowed to distribute profit shares [wei] to investors
    // (so, that they don't need to withdraw it by themselves)
    address public profitDistributor;

    // Amount of total profits [wei] stored to this token
    // In contrast to the wei balance (which may be reduced due to profit share withdrawal)
    // this value will never decrease
    uint public totalProfits;

    // As long as the total supply isn't fixed, i.e. new tokens can appear out of thin air,
    // the investors' profit shares aren't determined
    bool public totalSupplyIsFixed;

    // Total amount of tokens
    uint internal totalSupply_;


    /// @dev Log entry on change of profit deposit authority
    /// @param newProfitDepositor New authority's address
    event ProfitDepositorChange(address indexed newProfitDepositor);

    /// @dev Log entry on change of profit distribution authority
    /// @param newProfitDistributor New authority's address
    event ProfitDistributorChange(address indexed newProfitDistributor);

    /// @dev Log entry on profit deposit
    /// @param depositor Profit depositor's address
    /// @param amount Deposited profits in wei
    event ProfitDeposit(address indexed depositor, uint amount);

    /// @dev Log entry on profit share update
    /// @param investor Investor's address
    /// @param amount New wei amount the token owes the investor
    event ProfitShareUpdate(address indexed investor, uint amount);

    /// @dev Log entry on profit withdrawal
    /// @param investor Investor's address
    /// @param amount Wei amount the investor withdrew from this token
    event ProfitShareWithdrawal(address indexed investor, address indexed beneficiary, uint amount);


    /// @dev Restrict operation to profit deposit authority only
    modifier onlyProfitDepositor() {
        require(msg.sender == profitDepositor, "Restricted to profit depositor");
        _;
    }

    /// @dev Restrict operation to profit distribution authority only
    modifier onlyProfitDistributor() {
        require(msg.sender == profitDistributor, "Restricted to profit distributor");
        _;
    }

    /// @dev Constructor
    /// @param _profitDepositor Profit deposit authority
    constructor(address _profitDepositor) public {
        setProfitDepositor(_profitDepositor);
    }

    /// @dev Profit deposit if possible via fallback function
    function () public payable {
        depositProfit();
    }

    /// @dev Change profit depositor
    /// @param _newProfitDepositor An Ethereum address
    function setProfitDepositor(address _newProfitDepositor) public onlyOwner {
        require(_newProfitDepositor != address(0x0), "New profit depositor is zero");

        // Don't emit event if set for first time or to the same value again
        if (profitDepositor != address(0x0) && _newProfitDepositor != profitDepositor) {
            emit ProfitDepositorChange(_newProfitDepositor);
        }
        profitDepositor = _newProfitDepositor;
    }

    /// @dev Change profit distributor
    /// @param _newProfitDistributor An Ethereum address
    function setProfitDistributor(address _newProfitDistributor) public onlyOwner {
        require(_newProfitDistributor != address(0x0), "New profit distributor is zero");

        // Don't emit event if set for first time or to the same value again
        if (profitDistributor != address(0x0) && _newProfitDistributor != profitDistributor) {
            emit ProfitDistributorChange(_newProfitDistributor);
        }
        profitDistributor = _newProfitDistributor;
    }

    /// @dev Deposit profit
    function depositProfit() public payable onlyProfitDepositor {
        require(totalSupply_ > 0, "Total supply is zero");

        totalProfits = totalProfits.add(msg.value);

        emit ProfitDeposit(msg.sender, msg.value);
    }

    /// @dev Profit share owing
    /// @param _investor An Ethereum address
    /// @return A positive number
    function profitShareOwing(address _investor) public view returns (uint) {
        if (!totalSupplyIsFixed || totalSupply_ == 0) {
            return 0;
        }

        InvestorAccount memory account = accounts[_investor];

        return totalProfits.sub(account.lastTotalProfits)
                           .mul(account.balance)
                           .div(totalSupply_)
                           .add(account.profitShare);
    }

    /// @dev Update profit share
    /// @param _investor An Ethereum address
    function updateProfitShare(address _investor) public {
        require(totalSupplyIsFixed, "Total supply may change");

        uint newProfitShare = profitShareOwing(_investor);

        accounts[_investor].lastTotalProfits = totalProfits;
        accounts[_investor].profitShare = newProfitShare;

        emit ProfitShareUpdate(_investor, newProfitShare);
    }

    /// @dev Withdraw profit share
    function withdrawProfitShare() public {
        _withdrawProfitShare(msg.sender, msg.sender);
    }

    function withdrawProfitShareTo(address _beneficiary) public {
        _withdrawProfitShare(msg.sender, _beneficiary);
    }

    /// @dev Withdraw profit share
    function withdrawProfitShares(address[] _investors) public onlyProfitDistributor {
        for (uint i = 0; i < _investors.length; ++i) {
            _withdrawProfitShare(_investors[i], _investors[i]);
        }
    }

    /// @dev Withdraw profit share
    function _withdrawProfitShare(address _investor, address _beneficiary) internal {
        updateProfitShare(_investor);

        uint withdrawnProfitShare = accounts[_investor].profitShare;

        accounts[_investor].profitShare = 0;
        _beneficiary.transfer(withdrawnProfitShare);

        emit ProfitShareWithdrawal(_investor, _beneficiary, withdrawnProfitShare);
    }

}
