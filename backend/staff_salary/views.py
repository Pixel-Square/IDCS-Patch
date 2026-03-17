import ast
import calendar
from datetime import date

from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from academics.models import Department
from staff_requests.models import StaffLeaveBalance
from staff_requests.permissions import IsAdminOrHR

from .models import (
    SalaryDeductionType,
    SalaryEMIPlan,
    SalaryEarnType,
    SalaryFormulaConfig,
    SalaryMonthlyInput,
    SalaryPFConfig,
    StaffSalaryDeclaration,
)


DEFAULT_FORMULAS = {
    'working_days': 'days_in_month - lop_days',
    'lop_amount': '(basic_salary + allowance) / lop_days if lop_days > 0 else 0',
    'gross_salary': '(basic_salary + allowance) - lop_amount',
    'total_salary': 'gross_salary + total_earn',
    'net_salary': 'total_salary + pf_amount - od_new - total_deduction - others',
}


class SafeFormulaEvaluator:
    ALLOWED_NODES = {
        ast.Expression,
        ast.BinOp,
        ast.UnaryOp,
        ast.Add,
        ast.Sub,
        ast.Mult,
        ast.Div,
        ast.Mod,
        ast.Pow,
        ast.USub,
        ast.UAdd,
        ast.Load,
        ast.Name,
        ast.Constant,
        ast.IfExp,
        ast.Compare,
        ast.Gt,
        ast.GtE,
        ast.Lt,
        ast.LtE,
        ast.Eq,
        ast.NotEq,
        ast.BoolOp,
        ast.And,
        ast.Or,
    }

    @classmethod
    def evaluate(cls, expression, variables, default=0.0):
        if not expression:
            return float(default)
        try:
            tree = ast.parse(expression, mode='eval')
            for node in ast.walk(tree):
                if type(node) not in cls.ALLOWED_NODES:
                    return float(default)
                if isinstance(node, ast.Name) and node.id not in variables:
                    return float(default)
            value = eval(compile(tree, '<formula>', 'eval'), {'__builtins__': {}}, variables)
            return float(value)
        except Exception:
            return float(default)


class StaffSalaryViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def _check_hr(self, request):
        if IsAdminOrHR().has_permission(request, self):
            return True
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True
        # Fallback for deployments where roles are exposed via user.roles M2M
        if hasattr(user, 'roles'):
            try:
                return user.roles.filter(name__in=['HR', 'ADMIN']).exists()
            except Exception:
                return False
        return False

    def _month_to_date(self, month_str):
        parts = (month_str or '').split('-')
        if len(parts) != 2:
            raise ValueError('Invalid month format, use YYYY-MM')
        year = int(parts[0])
        month = int(parts[1])
        return date(year, month, 1)

    def _get_staff_queryset(self, department_id=None):
        User = get_user_model()
        qs = User.objects.filter(is_active=True, staff_profile__isnull=False).select_related('staff_profile', 'staff_profile__department')
        if department_id:
            try:
                dept_id = int(department_id)
                qs = qs.filter(staff_profile__department_id=dept_id)
            except (ValueError, TypeError):
                pass
        return qs.order_by('staff_profile__staff_id')

    def _get_pf_config(self):
        config, _ = SalaryPFConfig.objects.get_or_create(id=1)
        return config

    def _get_formula_config(self):
        formula_obj, _ = SalaryFormulaConfig.objects.get_or_create(id=1, defaults={'expressions': DEFAULT_FORMULAS})
        expr = dict(DEFAULT_FORMULAS)
        expr.update(formula_obj.expressions or {})
        return formula_obj, expr

    @action(detail=False, methods=['get', 'post'])
    def declarations(self, request):
        # Allow any authenticated user to view declarations, but only HR/Admin can modify
        if request.method.lower() == 'post' and not self._check_hr(request):
            return Response({'error': 'Only HR/Admin can modify declarations'}, status=status.HTTP_403_FORBIDDEN)

        if request.method.lower() == 'post':
            updates = request.data.get('items', [])
            for item in updates:
                staff_user_id = item.get('staff_user_id')
                if not staff_user_id:
                    continue
                User = get_user_model()
                try:
                    staff_user = User.objects.get(id=staff_user_id)
                except User.DoesNotExist:
                    continue
                obj, _ = StaffSalaryDeclaration.objects.get_or_create(staff=staff_user)
                obj.basic_salary = float(item.get('basic_salary') or 0)
                obj.allowance = float(item.get('allowance') or 0)
                obj.pf_enabled = bool(item.get('pf_enabled', True))
                obj.type2_pf_value = float(item.get('type2_pf_value') or 0)
                obj.save()
            return Response({'message': 'Declarations saved'})

        department_id = request.query_params.get('department_id')
        staff_users = list(self._get_staff_queryset(department_id=department_id))
        declaration_map = {d.staff_id: d for d in StaffSalaryDeclaration.objects.filter(staff_id__in=[u.id for u in staff_users])}

        rows = []
        for idx, staff in enumerate(staff_users, start=1):
            dec = declaration_map.get(staff.id)
            profile = getattr(staff, 'staff_profile', None)
            dept = getattr(profile, 'department', None) if profile else None
            rows.append({
                's_no': idx,
                'staff_user_id': staff.id,
                'staff_id': getattr(profile, 'staff_id', None) or staff.username,
                'name': staff.get_full_name() or staff.username,
                'department': {'id': dept.id if dept else None, 'name': dept.name if dept else 'N/A'},
                'basic_salary': float(dec.basic_salary if dec else 0),
                'allowance': float(dec.allowance if dec else 0),
                'pf_enabled': bool(dec.pf_enabled) if dec else True,
                'type2_pf_value': float(dec.type2_pf_value if dec else 0),
                'is_new': not bool(dec),
            })

        return Response({'count': len(rows), 'results': rows})

    @action(detail=False, methods=['get', 'post'])
    def pf_config(self, request):
        # Allow any authenticated user to view config, but only HR/Admin can modify
        if request.method.lower() == 'post' and not self._check_hr(request):
            return Response({'error': 'Only HR/Admin can modify PF config'}, status=status.HTTP_403_FORBIDDEN)

        config = self._get_pf_config()
        if request.method.lower() == 'post':
            payload = request.data or {}
            config.threshold_amount = float(payload.get('threshold_amount', config.threshold_amount))
            config.fixed_pf_amount = float(payload.get('fixed_pf_amount', config.fixed_pf_amount))
            config.percentage_rate = float(payload.get('percentage_rate', config.percentage_rate))
            config.type1_department_ids = [int(x) for x in payload.get('type1_department_ids', config.type1_department_ids or [])]
            config.type2_department_ids = [int(x) for x in payload.get('type2_department_ids', config.type2_department_ids or [])]
            config.save()

        departments = Department.objects.all().order_by('name').values('id', 'name')
        return Response({
            'threshold_amount': float(config.threshold_amount),
            'fixed_pf_amount': float(config.fixed_pf_amount),
            'percentage_rate': float(config.percentage_rate),
            'type1_department_ids': config.type1_department_ids or [],
            'type2_department_ids': config.type2_department_ids or [],
            'departments': list(departments),
        })

    @action(detail=False, methods=['get', 'post'])
    def deduction_types(self, request):
        if request.method.lower() == 'post' and not self._check_hr(request):
            return Response({'error': 'Only HR/Admin can modify deduction types'}, status=status.HTTP_403_FORBIDDEN)

        if request.method.lower() == 'post':
            items = request.data.get('items', [])
            for idx, item in enumerate(items, start=1):
                obj = None
                if item.get('id'):
                    obj = SalaryDeductionType.objects.filter(id=item['id']).first()
                if not obj:
                    obj = SalaryDeductionType()
                obj.name = str(item.get('name') or '').strip() or f'Deduction {idx}'
                obj.mode = item.get('mode') if item.get('mode') in ['emi', 'monthly'] else 'monthly'
                obj.is_active = bool(item.get('is_active', True))
                obj.sort_order = int(item.get('sort_order') or idx)
                obj.save()
            return Response({'message': 'Deduction types saved'})

        if not SalaryDeductionType.objects.exists():
            defaults = [
                ('Type 1', 'emi'),
                ('Type 2', 'emi'),
                ('Type 3', 'emi'),
                ('Type 4', 'monthly'),
                ('Type 5', 'monthly'),
                ('Type 6', 'monthly'),
            ]
            for idx, (name, mode) in enumerate(defaults, start=1):
                SalaryDeductionType.objects.create(name=name, mode=mode, is_active=True, sort_order=idx)

        rows = SalaryDeductionType.objects.all().values('id', 'name', 'mode', 'is_active', 'sort_order')
        return Response({'results': list(rows)})

    @action(detail=False, methods=['get', 'post'])
    def earn_types(self, request):
        if request.method.lower() == 'post' and not self._check_hr(request):
            return Response({'error': 'Only HR/Admin can modify earn types'}, status=status.HTTP_403_FORBIDDEN)

        if request.method.lower() == 'post':
            items = request.data.get('items', [])
            for idx, item in enumerate(items, start=1):
                obj = None
                if item.get('id'):
                    obj = SalaryEarnType.objects.filter(id=item['id']).first()
                if not obj:
                    obj = SalaryEarnType()
                obj.name = str(item.get('name') or '').strip() or f'Earn {idx}'
                obj.is_active = bool(item.get('is_active', True))
                obj.sort_order = int(item.get('sort_order') or idx)
                obj.save()
            return Response({'message': 'Earn types saved'})

        if not SalaryEarnType.objects.exists():
            defaults = ['Earn Type 1', 'Earn Type 2', 'Earn Type 3']
            for idx, name in enumerate(defaults, start=1):
                SalaryEarnType.objects.create(name=name, is_active=True, sort_order=idx)

        rows = SalaryEarnType.objects.all().values('id', 'name', 'is_active', 'sort_order')
        return Response({'results': list(rows)})

    @action(detail=False, methods=['get', 'post'])
    def emi_plans(self, request):
        if request.method.lower() == 'post' and not self._check_hr(request):
            return Response({'error': 'Only HR/Admin can modify EMI plans'}, status=status.HTTP_403_FORBIDDEN)

        if request.method.lower() == 'post':
            items = request.data.get('items', [])
            User = get_user_model()
            for item in items:
                staff_user_id = item.get('staff_user_id')
                deduction_type_id = item.get('deduction_type_id')
                start_month = item.get('start_month')
                if not staff_user_id or not deduction_type_id or not start_month:
                    continue
                try:
                    staff = User.objects.get(id=staff_user_id)
                    dtype = SalaryDeductionType.objects.get(id=deduction_type_id)
                    month_date = self._month_to_date(start_month)
                except Exception:
                    continue
                plan, _ = SalaryEMIPlan.objects.get_or_create(
                    staff=staff,
                    deduction_type=dtype,
                    start_month=month_date,
                    defaults={'months': 1, 'total_amount': 0.0},
                )
                plan.total_amount = float(item.get('total_amount') or 0)
                plan.months = max(1, int(item.get('months') or 1))
                plan.is_active = bool(item.get('is_active', True))
                plan.save()
            return Response({'message': 'EMI plans saved'})

        staff_user_id = request.query_params.get('staff_user_id')
        qs = SalaryEMIPlan.objects.select_related('staff', 'staff__staff_profile', 'deduction_type')
        if staff_user_id:
            qs = qs.filter(staff_id=staff_user_id)

        results = []
        for p in qs.order_by('-start_month'):
            profile = getattr(p.staff, 'staff_profile', None)
            results.append({
                'id': p.id,
                'staff_user_id': p.staff_id,
                'staff_id': getattr(profile, 'staff_id', None) or p.staff.username,
                'staff_name': p.staff.get_full_name() or p.staff.username,
                'deduction_type_id': p.deduction_type_id,
                'deduction_type_name': p.deduction_type.name,
                'total_amount': float(p.total_amount),
                'months': p.months,
                'start_month': p.start_month.strftime('%Y-%m'),
                'is_active': p.is_active,
            })
        return Response({'results': results})

    @action(detail=False, methods=['get', 'post'])
    def formulas(self, request):
        if request.method.lower() == 'post' and not self._check_hr(request):
            return Response({'error': 'Only HR/Admin can modify formulas'}, status=status.HTTP_403_FORBIDDEN)

        obj, current = self._get_formula_config()
        if request.method.lower() == 'post':
            incoming = request.data.get('expressions', {}) or {}
            merged = dict(DEFAULT_FORMULAS)
            merged.update(current)
            for key, value in incoming.items():
                merged[key] = str(value)
            obj.expressions = merged
            obj.save()
            current = merged

        return Response({'expressions': current, 'defaults': DEFAULT_FORMULAS})

    @action(detail=False, methods=['get', 'post'])
    def monthly_sheet(self, request):
        if request.method.lower() == 'post' and not self._check_hr(request):
            return Response({'error': 'Only HR/Admin can modify monthly sheet'}, status=status.HTTP_403_FORBIDDEN)

        month_str = request.query_params.get('month') or request.data.get('month')
        if not month_str:
            return Response({'error': 'month is required (YYYY-MM)'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            month_date = self._month_to_date(month_str)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        if request.method.lower() == 'post':
            updates = request.data.get('items', [])
            User = get_user_model()
            for item in updates:
                staff_user_id = item.get('staff_user_id')
                if not staff_user_id:
                    continue
                try:
                    staff = User.objects.get(id=staff_user_id)
                except User.DoesNotExist:
                    continue
                row, _ = SalaryMonthlyInput.objects.get_or_create(staff=staff, month=month_date)
                row.earn_values = item.get('earn_values') or row.earn_values or {}
                row.deduction_values = item.get('deduction_values') or row.deduction_values or {}
                row.od_new = float(item.get('od_new', row.od_new or 0))
                row.others = float(item.get('others', row.others or 0))
                row.save()

        days_in_month = calendar.monthrange(month_date.year, month_date.month)[1]
        pf_config = self._get_pf_config()
        _, formulas = self._get_formula_config()

        earn_types = list(SalaryEarnType.objects.filter(is_active=True).order_by('sort_order', 'id'))
        deduction_types = list(SalaryDeductionType.objects.filter(is_active=True).order_by('sort_order', 'id'))
        emi_type_ids = {d.id for d in deduction_types if d.mode == 'emi'}

        staff_users = list(self._get_staff_queryset(department_id=request.query_params.get('department_id')))
        staff_ids = [u.id for u in staff_users]

        declaration_map = {d.staff_id: d for d in StaffSalaryDeclaration.objects.filter(staff_id__in=staff_ids)}
        monthly_map = {
            m.staff_id: m
            for m in SalaryMonthlyInput.objects.filter(staff_id__in=staff_ids, month=month_date)
        }

        lop_map = {
            b.staff_id: float(b.balance or 0)
            for b in StaffLeaveBalance.objects.filter(staff_id__in=staff_ids, leave_type='LOP')
        }

        emi_plans = SalaryEMIPlan.objects.filter(
            staff_id__in=staff_ids,
            deduction_type_id__in=list(emi_type_ids),
            is_active=True,
        ).select_related('deduction_type')

        emi_amount_map = {}
        for plan in emi_plans:
            month_delta = (month_date.year - plan.start_month.year) * 12 + (month_date.month - plan.start_month.month)
            if month_delta < 0 or month_delta >= plan.months:
                continue
            key = (plan.staff_id, plan.deduction_type_id)
            emi_amount_map[key] = round(float(plan.total_amount or 0) / max(1, plan.months), 2)

        rows = []
        for idx, staff in enumerate(staff_users, start=1):
            profile = getattr(staff, 'staff_profile', None)
            dept = getattr(profile, 'department', None) if profile else None
            declaration = declaration_map.get(staff.id)
            monthly = monthly_map.get(staff.id)

            basic_salary = float(declaration.basic_salary if declaration else 0)
            allowance = float(declaration.allowance if declaration else 0)
            pf_enabled = bool(declaration.pf_enabled) if declaration else True
            lop_days = max(0.0, float(lop_map.get(staff.id, 0.0)))

            earn_values = {}
            total_earn = 0.0
            monthly_earn_values = (monthly.earn_values if monthly else {}) or {}
            for e in earn_types:
                amount = float(monthly_earn_values.get(str(e.id), 0) or 0)
                earn_values[str(e.id)] = amount
                total_earn += amount

            deduction_values = {}
            total_deduction = 0.0
            monthly_deduction_values = (monthly.deduction_values if monthly else {}) or {}
            for d in deduction_types:
                if d.mode == 'emi':
                    amount = float(emi_amount_map.get((staff.id, d.id), 0) or 0)
                else:
                    amount = float(monthly_deduction_values.get(str(d.id), 0) or 0)
                deduction_values[str(d.id)] = amount
                total_deduction += amount

            od_new = float(monthly.od_new if monthly else 0)
            others = float(monthly.others if monthly else 0)

            context = {
                'days_in_month': float(days_in_month),
                'lop_days': lop_days,
                'basic_salary': basic_salary,
                'allowance': allowance,
                'total_earn': total_earn,
                'total_deduction': total_deduction,
                'od_new': od_new,
                'others': others,
            }

            working_days = SafeFormulaEvaluator.evaluate(formulas.get('working_days'), context, default=context['days_in_month'] - lop_days)
            context['working_days'] = working_days
            lop_amount = SafeFormulaEvaluator.evaluate(formulas.get('lop_amount'), context, default=((basic_salary + allowance) / lop_days if lop_days > 0 else 0))
            context['lop_amount'] = lop_amount
            gross_salary = SafeFormulaEvaluator.evaluate(formulas.get('gross_salary'), context, default=(basic_salary + allowance) - lop_amount)
            context['gross_salary'] = gross_salary
            total_salary = SafeFormulaEvaluator.evaluate(formulas.get('total_salary'), context, default=gross_salary + total_earn)
            context['total_salary'] = total_salary

            pf_amount = 0.0
            dept_id = dept.id if dept else None
            if pf_enabled and dept_id in (pf_config.type1_department_ids or []):
                if total_salary >= float(pf_config.threshold_amount):
                    pf_amount = float(pf_config.fixed_pf_amount)
                else:
                    pf_amount = total_salary * float(pf_config.percentage_rate) / 100.0
            elif pf_enabled and dept_id in (pf_config.type2_department_ids or []):
                # Use staff's individual Type 2 PF value from declaration
                try:
                    declaration = StaffSalaryDeclaration.objects.get(staff_id=staff.id)
                    pf_amount = float(declaration.type2_pf_value)
                except StaffSalaryDeclaration.DoesNotExist:
                    pf_amount = 0.0

            context['pf_amount'] = pf_amount
            net_salary = SafeFormulaEvaluator.evaluate(
                formulas.get('net_salary'),
                context,
                default=(total_salary + pf_amount - od_new - total_deduction - others),
            )

            rows.append({
                's_no': idx,
                'staff_user_id': staff.id,
                'staff_id': getattr(profile, 'staff_id', None) or staff.username,
                'staff_name': staff.get_full_name() or staff.username,
                'department': {'id': dept.id if dept else None, 'name': dept.name if dept else 'N/A'},
                'basic_salary': round(basic_salary, 2),
                'allowance': round(allowance, 2),
                'days': round(working_days, 2),
                'gross_salary': round(gross_salary, 2),
                'lop_days': round(lop_days, 2),
                'lop_amount': round(lop_amount, 2),
                'earn_values': earn_values,
                'total_salary': round(total_salary, 2),
                'pf_amount': round(pf_amount, 2),
                'od_new': round(od_new, 2),
                'deduction_values': deduction_values,
                'others': round(others, 2),
                'net_salary': round(net_salary, 2),
            })

        return Response({
            'month': month_str,
            'days_in_month': days_in_month,
            'earn_types': [{'id': e.id, 'name': e.name} for e in earn_types],
            'deduction_types': [{'id': d.id, 'name': d.name, 'mode': d.mode} for d in deduction_types],
            'results': rows,
            'formulas': formulas,
        })
