<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import UserCenterShell from '@/components/UserCenterShell.vue'
import { api } from '@/api'
import type { Passenger } from '@/types/api'

const list=ref<Passenger[]>([]);const visible=ref(false);const editing=ref<number|null>(null);const form=reactive({name:'',idType:'ID_CARD',idNo:'',passengerType:'ADULT',phone:''})
async function load(){list.value=await api.user.passengers()}onMounted(load)
function open(item?:Passenger){editing.value=item?.id||null;Object.assign(form,{name:item?.name||'',idType:item?.idType||'ID_CARD',idNo:'',passengerType:item?.passengerType||'ADULT',phone:item?.phone||''});visible.value=true}
async function save(){editing.value?await api.user.updatePassenger(editing.value,form):await api.user.createPassenger(form);visible.value=false;ElMessage.success('乘车人信息已保存');load()}
async function remove(id:number){await api.user.removePassenger(id);ElMessage.success('已删除');load()}
</script>
<template><UserCenterShell><div class="section-title"><div><h2>常用乘车人</h2><p>用于购票实名校验，同一账号证件号码不可重复</p></div><el-button type="primary" @click="open()">新增乘车人</el-button></div><el-table :data="list"><el-table-column prop="name" label="姓名"/><el-table-column prop="idType" label="证件类型"/><el-table-column prop="idNoMasked" label="证件号码"/><el-table-column prop="passengerType" label="旅客类型"/><el-table-column prop="phone" label="手机号"/><el-table-column label="操作" width="150"><template #default="{row}"><el-button link type="primary" @click="open(row)">编辑</el-button><el-popconfirm title="确认删除该乘车人？" @confirm="remove(row.id)"><template #reference><el-button link type="danger">删除</el-button></template></el-popconfirm></template></el-table-column></el-table><el-dialog v-model="visible" :title="editing?'编辑乘车人':'新增乘车人'" width="520"><el-form :model="form" label-width="90px"><el-form-item label="姓名"><el-input v-model="form.name"/></el-form-item><el-form-item label="证件类型"><el-select v-model="form.idType" style="width:100%"><el-option label="居民身份证" value="ID_CARD"/><el-option label="护照" value="PASSPORT"/></el-select></el-form-item><el-form-item label="证件号码"><el-input v-model="form.idNo"/></el-form-item><el-form-item label="旅客类型"><el-radio-group v-model="form.passengerType"><el-radio value="ADULT">成人</el-radio><el-radio value="STUDENT">学生</el-radio><el-radio value="CHILD">儿童</el-radio></el-radio-group></el-form-item><el-form-item label="手机号"><el-input v-model="form.phone"/></el-form-item></el-form><template #footer><el-button @click="visible=false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template></el-dialog></UserCenterShell></template>
