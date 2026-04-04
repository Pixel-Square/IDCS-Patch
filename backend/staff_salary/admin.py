from django.contrib import admin

from .models import (
    SalaryBankDeclaration,
    SalaryDeductionType,
    SalaryEMIPlan,
    SalaryEarnType,
    SalaryFormulaConfig,
    SalaryMonthPublish,
    SalaryMonthlyInput,
    SalaryPFConfig,
    SalaryPublishedReceipt,
    StaffSalaryDeclaration,
)


admin.site.register(StaffSalaryDeclaration)
admin.site.register(SalaryBankDeclaration)
admin.site.register(SalaryPFConfig)
admin.site.register(SalaryFormulaConfig)
admin.site.register(SalaryDeductionType)
admin.site.register(SalaryEarnType)
admin.site.register(SalaryEMIPlan)
admin.site.register(SalaryMonthlyInput)
admin.site.register(SalaryMonthPublish)
admin.site.register(SalaryPublishedReceipt)
