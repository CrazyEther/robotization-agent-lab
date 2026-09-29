import {evaluateInvestment,type FinanceInput,type SimulationInput,type SimulationResult} from './contracts';

/** An explicitly conditional cash-flow projection, separate from technical feasibility. */
export type ConditionalFinancialResult={
 annualCompleted:number;annualDemand:number;annualShortfall:number;coveragePercent:number|null;
 financiallySpecified:boolean;
 extraCoverageCostAnnual:number|null;
 upperBoundRoiPercent:number|null;upperBoundNpv:number|null;
 assumedRoiPercent:number|null;assumedNpv:number|null;assumedPaybackYears:number|null;
 assumedNetAnnualBenefit:number|null;assumedTco:number|null;
};

/**
 * Upper bounds assume zero *additional* cost for work the fleet cannot do.
 * A populated extraCoverageCostAnnual means the operator explicitly supplied
 * the cost of covering the remaining volume. Even then these values are
 * financial scenarios, not evidence that staffing/capacity is sufficient.
 */
export function evaluateConditionalFinancials(
 scenario:SimulationInput,
 result:Pick<SimulationResult,'completed'|'energyKwh'|'backlog'>,
 finance:FinanceInput,
 extraCoverageCostAnnual:number|null
):ConditionalFinancialResult{
 const base=evaluateInvestment(scenario,result,finance);
 if(extraCoverageCostAnnual!==null&&(!Number.isFinite(extraCoverageCostAnnual)||extraCoverageCostAnnual<0))
  throw new Error('Дополнительные затраты должны быть неотрицательным числом.');
 const annualShortfall=Math.max(0,finance.annualDemand-base.annualCompleted);
 const financiallySpecified=finance.annualDemand>0&&finance.daysPerYear>0&&
  finance.baselineAnnualCompleted>=finance.annualDemand&&
  finance.baselineCostAnnual>0&&finance.baselineCostAnnual>=finance.residualHumanCostAnnual&&base.capex>0;
 const empty={annualCompleted:base.annualCompleted,annualDemand:finance.annualDemand,annualShortfall,
  coveragePercent:finance.annualDemand>0?base.annualCompleted/finance.annualDemand*100:null,financiallySpecified,
  extraCoverageCostAnnual,upperBoundRoiPercent:null,upperBoundNpv:null,
  assumedRoiPercent:null,assumedNpv:null,assumedPaybackYears:null,
  assumedNetAnnualBenefit:null,assumedTco:null};
 if(!financiallySpecified)return empty;
 const npv=(net:number)=>-base.capex+Array.from({length:finance.horizonYears},
  (_,i)=>net/(1+finance.discountRatePercent/100)**(i+1)).reduce((sum,flow)=>sum+flow,0);
 const roi=(net:number)=>(net*finance.horizonYears-base.capex)/base.capex*100;
 const upperBoundRoiPercent=roi(base.netAnnualBenefit);
 const upperBoundNpv=npv(base.netAnnualBenefit);
 if(annualShortfall>0&&extraCoverageCostAnnual===null)
  return {...empty,upperBoundRoiPercent,upperBoundNpv};
 const addedCost=annualShortfall===0?0:extraCoverageCostAnnual??0;
 const assumedNetAnnualBenefit=base.netAnnualBenefit-addedCost;
 return {...empty,upperBoundRoiPercent,upperBoundNpv,
  assumedRoiPercent:roi(assumedNetAnnualBenefit),assumedNpv:npv(assumedNetAnnualBenefit),
  assumedPaybackYears:assumedNetAnnualBenefit>0?base.capex/assumedNetAnnualBenefit:null,
  assumedNetAnnualBenefit,assumedTco:base.tco+addedCost*finance.horizonYears};
}
